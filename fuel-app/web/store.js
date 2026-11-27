/*
 * Data layer. Two back ends with the same API:
 *   - LocalStore (default): one driver per phone; claims in localStorage, photos in IndexedDB.
 *   - FirebaseStore: Firebase Auth + Cloud Firestore (receipt photos are stored in Firestore,
 *     so the free Spark plan is enough; no Cloud Storage bucket is needed).
 *
 * Claim status flow: draft → submitted → verified → approved → paid
 *                    (returned = sent back to the driver to fix, rejected = closed)
 */
(function () {
  "use strict";

  var ROLES = ["driver", "verifier", "approver", "admin"];
  var ROLE_LABELS = { driver: "Driver", verifier: "Verifier", approver: "Approver", admin: "Administrator" };
  var STATUS = {
    draft: { label: "Draft", tone: "muted" },
    submitted: { label: "Submitted", tone: "info" },
    verified: { label: "Verified", tone: "info" },
    approved: { label: "Approved", tone: "good" },
    paid: { label: "Paid", tone: "good" },
    returned: { label: "Returned", tone: "warn" },
    rejected: { label: "Rejected", tone: "bad" }
  };

  // Which roles may take which action, and the status it leads to.
  var ACTIONS = {
    submit: { to: "submitted", from: ["draft", "returned"], roles: ["owner"] },
    verify: { to: "verified", from: ["submitted"], roles: ["verifier", "admin"] },
    approve: { to: "approved", from: ["verified"], roles: ["approver", "admin"] },
    pay: { to: "paid", from: ["approved"], roles: ["approver", "admin"] },
    "return": { to: "returned", from: ["submitted", "verified"], roles: ["verifier", "approver", "admin"] },
    reject: { to: "rejected", from: ["submitted", "verified"], roles: ["verifier", "approver", "admin"] }
  };

  function can(profile, action, claim) {
    var a = ACTIONS[action];
    if (!a || !profile || !claim) return false;
    if (a.from.indexOf(claim.status) < 0) return false;
    if (a.roles.indexOf("owner") >= 0) return claim.ownerUid === profile.uid;
    return a.roles.indexOf(profile.role) >= 0;
  }

  function isStaff(p) {
    return !!p && p.role !== "driver";
  }

  function now() {
    return Date.now();
  }

  function totals(receipts) {
    var t = { count: 0, litres: 0, amount: 0 };
    (receipts || []).forEach(function (r) {
      t.count++;
      t.litres += Number(r.litres) || 0;
      t.amount += Number(r.amount) || 0;
    });
    t.litres = Math.round(t.litres * 100) / 100;
    t.amount = Math.round(t.amount * 1000) / 1000;
    return t;
  }

  function applyAction(claim, action, actor, data) {
    var a = ACTIONS[action];
    var c = JSON.parse(JSON.stringify(claim));
    data = data || {};
    c.status = a.to;
    c.updatedAt = now();
    c.history = c.history || [];
    c.history.push({ status: a.to, action: action, byUid: actor.uid, byName: actor.name, at: now(), note: data.note || "" });
    if (action === "submit") {
      c.submittedAt = now();
      c.submissionDate = c.submissionDate || new Date().toISOString().slice(0, 10);
    } else if (action === "verify") {
      c.verifiedBy = actor.name;
      c.verifiedByUid = actor.uid;
      c.verifiedAt = now();
    } else if (action === "approve") {
      c.approvedBy = actor.name;
      c.approvedByUid = actor.uid;
      c.approvedAt = now();
      c.amountApproved = Number(data.amountApproved);
      c.approverSignature = data.signature || "";
    } else if (action === "pay") {
      c.paidAt = now();
      c.paidRef = data.reference || "";
    }
    if (data.note) c.remarks = data.note;
    return c;
  }

  // ------------------------------------------------------------------ small IndexedDB helper (photos on the phone)

  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open("ezfuel-photos", 1);
      r.onupgradeneeded = function () {
        r.result.createObjectStore("photos");
      };
      r.onsuccess = function () {
        res(r.result);
      };
      r.onerror = function () {
        rej(r.error);
      };
    });
  }

  function idbGet(key) {
    return idb().then(function (d) {
      return new Promise(function (res) {
        var q = d.transaction("photos").objectStore("photos").get(key);
        q.onsuccess = function () {
          res(q.result || null);
        };
        q.onerror = function () {
          res(null);
        };
      });
    });
  }

  function idbDel(key) {
    return idb().then(function (d) {
      d.transaction("photos", "readwrite").objectStore("photos").delete(key);
    }).catch(function () {});
  }

  function idbPut(key, val) {
    return idb().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction("photos", "readwrite");
        tx.objectStore("photos").put(val, key);
        tx.oncomplete = function () {
          res();
        };
        tx.onerror = function () {
          rej(tx.error);
        };
      });
    });
  }

  // ------------------------------------------------------------------ On-phone store (one driver per phone)

  function LocalStore() {
    var PROFILE = "ezfuel-profile", CLAIMS = "ezfuel-claims", COUNTER = "ezfuel-counter", BILLS = "ezfuel-bills";
    var profile = read(PROFILE, null);
    var claims = read(CLAIMS, []);
    var bills = read(BILLS, null);
    var authCbs = [], claimCbs = [], billCbs = [];
    if (bills === null) migrate();

    /** Version 1.x kept receipts inside claims. Turn them into bills: drafts become unclaimed bills. */
    function migrate() {
      bills = [];
      claims.forEach(function (c) {
        var claimed = c.status !== "draft";
        c.billIds = [];
        (c.receipts || []).forEach(function (r) {
          var b = { id: r.id || "b" + now() + Math.random().toString(36).slice(2, 6), date: r.date, station: r.station,
            odometer: r.odometer, litres: r.litres, amount: r.amount, photoId: r.photoId || "",
            claimId: claimed ? c.id : null, createdAt: c.createdAt || now() };
          r.id = b.id;
          bills.push(b);
          if (claimed) c.billIds.push(b.id);
        });
      });
      claims = claims.filter(function (c) { return c.status !== "draft"; });
      try {
        write(BILLS, bills);
        write(CLAIMS, claims);
      } catch (e) {}
    }

    function emitBills() {
      var list = bills.slice();
      billCbs.forEach(function (cb) { cb(list); });
    }

    function read(k, def) {
      try {
        var v = JSON.parse(localStorage.getItem(k));
        return v === null || v === undefined ? def : v;
      } catch (e) {
        return def;
      }
    }

    function write(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {
        throw new Error("The phone's storage is full. Delete old claims or free some space.");
      }
    }

    function emit() {
      var list = claims.slice().sort(function (x, y) { return (y.updatedAt || 0) - (x.updatedAt || 0); });
      claimCbs.forEach(function (cb) { cb(list); });
    }

    function tellAuth() {
      authCbs.forEach(function (cb) { cb(profile); });
    }

    return {
      mode: "local",
      ROLES: ROLES,
      init: function () {
        return Promise.resolve();
      },
      onAuth: function (cb) {
        authCbs.push(cb);
        setTimeout(function () { cb(profile); }, 0);
      },
      createProfile: function (f) {
        profile = { uid: "me", name: f.name, employeeId: f.employeeId, department: f.department, vehicle: f.vehicle, role: "driver", active: true };
        write(PROFILE, profile);
        tellAuth();
        return Promise.resolve(profile);
      },
      updateProfile: function (f) {
        ["name", "employeeId", "department", "vehicle", "signature"].forEach(function (k) { if (k in f) profile[k] = f[k]; });
        write(PROFILE, profile);
        tellAuth();
        return Promise.resolve(profile);
      },
      signOut: function () {
        return Promise.resolve();
      },
      watchClaims: function (scope, cb) {
        if (scope !== "mine") return function () {};
        claimCbs.push(cb);
        setTimeout(emit, 0);
        return function () {
          claimCbs = claimCbs.filter(function (x) { return x !== cb; });
        };
      },
      newClaimNo: function () {
        var year = new Date().getFullYear(), c = read(COUNTER, { year: year, next: 1 });
        if (c.year !== year) c = { year: year, next: 1 };
        var n = c.next;
        write(COUNTER, { year: year, next: n + 1 });
        var emp = String(profile.employeeId || "").replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
        return Promise.resolve("FUEL-" + (emp ? emp + "-" : "") + year + "-" + ("00" + n).slice(-3));
      },
      saveClaim: function (claim) {
        claim.updatedAt = now();
        if (!claim.id) {
          claim.id = "c" + now();
          claim.createdAt = now();
        }
        claim.totals = totals(claim.receipts);
        var copy = JSON.parse(JSON.stringify(claim));
        var i = claims.map(function (c) { return c.id; }).indexOf(claim.id);
        if (i >= 0) claims[i] = copy;
        else claims.push(copy);
        try {
          write(CLAIMS, claims);
        } catch (e) {
          return Promise.reject(e);
        }
        emit();
        return Promise.resolve(copy);
      },
      /** Deleting a claim puts its bills back in the list, ready for a new claim. */
      deleteClaim: function (id) {
        claims = claims.filter(function (c) { return c.id !== id; });
        bills.forEach(function (b) { if (b.claimId === id) b.claimId = null; });
        write(CLAIMS, claims);
        write(BILLS, bills);
        emit();
        emitBills();
        return Promise.resolve();
      },

      // ---- fuel bills ----
      watchBills: function (cb) {
        billCbs.push(cb);
        setTimeout(function () { cb(bills.slice()); }, 0);
        return function () {
          billCbs = billCbs.filter(function (x) { return x !== cb; });
        };
      },
      saveBill: function (bill) {
        var b = JSON.parse(JSON.stringify(bill));
        if (!b.id) {
          b.id = "b" + now() + Math.random().toString(36).slice(2, 6);
          b.createdAt = now();
          b.claimId = null;
        }
        b.updatedAt = now();
        var i = bills.map(function (x) { return x.id; }).indexOf(b.id);
        if (i >= 0) bills[i] = b;
        else bills.push(b);
        try {
          write(BILLS, bills);
        } catch (e) {
          return Promise.reject(e);
        }
        emitBills();
        return Promise.resolve(b);
      },
      deleteBill: function (id) {
        var b = bills.filter(function (x) { return x.id === id; })[0];
        if (!b) return Promise.resolve();
        if (b.claimId) return Promise.reject(new Error("This bill is part of a claim. Delete the claim first."));
        bills = bills.filter(function (x) { return x.id !== id; });
        write(BILLS, bills);
        emitBills();
        if (b.photoId) idbDel(b.photoId);
        return Promise.resolve();
      },
      /** Makes a submitted claim from the given bills (oldest first) and marks them as claimed. */
      createClaim: function (billIds, extra) {
        var self = this;
        var chosen = bills.filter(function (b) { return billIds.indexOf(b.id) >= 0 && !b.claimId; })
          .sort(function (a, b) { return (a.date || "").localeCompare(b.date || "") || (Number(a.odometer) || 0) - (Number(b.odometer) || 0); });
        if (!chosen.length) return Promise.reject(new Error("No bills to claim."));
        return self.newClaimNo().then(function (no) {
          var t = now();
          var c = {
            claimNo: no, ownerUid: "me", driverName: profile.name, employeeId: profile.employeeId, department: profile.department,
            vehicle: profile.vehicle, periodFrom: chosen[0].date, periodTo: chosen[chosen.length - 1].date,
            submissionDate: new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 10),
            receipts: chosen.map(function (b) {
              return { id: b.id, date: b.date, station: b.station, odometer: b.odometer, litres: b.litres, amount: b.amount, photoId: b.photoId };
            }),
            billIds: chosen.map(function (b) { return b.id; }), declaration: true, driverSignature: (extra && extra.signature) || "",
            status: "submitted", submittedAt: t, history: [{ status: "submitted", action: "submit", byUid: "me", byName: profile.name, at: t, note: "" }]
          };
          return self.saveClaim(c);
        }).then(function (saved) {
          bills.forEach(function (b) { if (saved.billIds.indexOf(b.id) >= 0) b.claimId = saved.id; });
          write(BILLS, bills);
          emitBills();
          return saved;
        });
      },
      /** On the phone the driver moves their own claim: finish (submit), mark paid, or reopen. */
      act: function (claim, action, data) {
        var c = JSON.parse(JSON.stringify(claim));
        data = data || {};
        c.history = c.history || [];
        if (action === "submit") {
          c.status = "submitted";
          c.submittedAt = now();
          c.submissionDate = c.submissionDate || new Date().toISOString().slice(0, 10);
        } else if (action === "markPaid") {
          c.status = "paid";
          c.paidAt = data.paidAt || now();
          c.paidAmount = Number(data.amount);
          c.paidRef = data.reference || "";
        } else if (action === "reopen") {
          c.status = "submitted";
          delete c.paidAt;
          delete c.paidAmount;
          delete c.paidRef;
        } else {
          return Promise.reject(new Error("Unknown action"));
        }
        c.history.push({ status: c.status, action: action, byUid: "me", byName: profile.name, at: now(), note: data.note || "" });
        return this.saveClaim(c);
      },
      savePhoto: function (claimId, dataUrl) {
        var id = "p" + now() + Math.random().toString(36).slice(2, 6);
        return idbPut(id, dataUrl).then(function () { return id; }).catch(function () {
          throw new Error("Couldn't store the photo. The phone may be out of space.");
        });
      },
      getPhoto: function (claimId, photoId) {
        return photoId ? idbGet(photoId) : Promise.resolve(null);
      }
    };
  }

  // ------------------------------------------------------------------ Firebase store

  function FirebaseStore(cfg) {
    var app, auth, db;
    var current = null;
    var authCbs = [];

    function profileOf(user) {
      return db.collection("users").doc(user.uid).get().then(function (snap) {
        if (snap.exists) {
          var p = snap.data();
          p.uid = user.uid;
          return p;
        }
        var pending = JSON.parse(sessionStorage.getItem("ezfuel-signup") || "{}");
        var p2 = {
          name: pending.name || user.email.split("@")[0], email: user.email,
          employeeId: pending.employeeId || "", department: pending.department || "", vehicle: pending.vehicle || "",
          role: "driver", active: true, createdAt: now()
        };
        return db.collection("users").doc(user.uid).set(p2).then(function () {
          sessionStorage.removeItem("ezfuel-signup");
          p2.uid = user.uid;
          return p2;
        });
      });
    }

    function friendly(e) {
      var m = {
        "auth/invalid-credential": "Wrong email or password.",
        "auth/wrong-password": "Wrong email or password.",
        "auth/user-not-found": "No account with that email. Create one first.",
        "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
        "auth/weak-password": "Use a password with at least 6 characters.",
        "auth/invalid-email": "That email address doesn't look right.",
        "auth/network-request-failed": "No internet connection. Try again when you're online.",
        "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
        "permission-denied": "You don't have permission to do that."
      };
      return new Error(m[e && e.code] || (e && e.message) || "Something went wrong.");
    }

    function clean(obj) {
      return JSON.parse(JSON.stringify(obj));
    }

    return {
      mode: "firebase",
      ROLES: ROLES,
      init: function () {
        app = firebase.initializeApp(cfg);
        auth = firebase.auth();
        db = firebase.firestore();
        if ((window.EZ_CONFIG || {}).useEmulators) {
          // local test database (developers only)
          auth.useEmulator("http://localhost:9099", { disableWarnings: true });
          db.useEmulator("localhost", 8080);
        }
        try {
          db.enablePersistence({ synchronizeTabs: true }).catch(function () {});
        } catch (e) {}
        return Promise.resolve();
      },
      onAuth: function (cb) {
        authCbs.push(cb);
        auth.onAuthStateChanged(function (user) {
          if (!user) {
            current = null;
            cb(null);
            return;
          }
          profileOf(user).then(function (p) {
            current = p;
            cb(p);
          }).catch(function () {
            current = null;
            cb(null);
          });
        });
      },
      signIn: function (email, pw) {
        return auth.signInWithEmailAndPassword(email, pw).catch(function (e) { throw friendly(e); });
      },
      signUp: function (f) {
        sessionStorage.setItem("ezfuel-signup", JSON.stringify(f));
        return auth.createUserWithEmailAndPassword(f.email, f.password).catch(function (e) { throw friendly(e); });
      },
      resetPassword: function (email) {
        return auth.sendPasswordResetEmail(email).catch(function (e) { throw friendly(e); });
      },
      signOut: function () {
        return auth.signOut();
      },
      updateProfile: function (fields) {
        var allowed = {};
        ["name", "employeeId", "department", "vehicle"].forEach(function (k) {
          if (k in fields) allowed[k] = fields[k];
        });
        return db.collection("users").doc(current.uid).update(allowed).then(function () {
          for (var k in allowed) current[k] = allowed[k];
          authCbs.forEach(function (cb) { cb(current); });
          return current;
        }).catch(function (e) { throw friendly(e); });
      },
      watchClaims: function (scope, cb) {
        var q = scope === "all"
          ? db.collection("claims").where("status", "in", ["submitted", "verified", "approved", "paid", "returned", "rejected"])
          : db.collection("claims").where("ownerUid", "==", current.uid);
        return q.onSnapshot(function (snap) {
          var list = snap.docs.map(function (d) {
            var c = d.data();
            c.id = d.id;
            return c;
          }).sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
          });
          cb(list);
        }, function (e) {
          cb([], friendly(e));
        });
      },
      newClaimNo: function () {
        var ref = db.collection("counters").doc("claims");
        var year = new Date().getFullYear();
        return db.runTransaction(function (tx) {
          return tx.get(ref).then(function (s) {
            var n = (s.exists && s.data().year === year ? s.data().next : 1);
            tx.set(ref, { next: n + 1, year: year });
            return n;
          });
        }).then(function (n) {
          return "EZ-FUEL-" + year + "-" + ("000" + n).slice(-4);
        }).catch(function () {
          return "EZ-FUEL-" + year + "-" + String(now()).slice(-6);
        });
      },
      saveClaim: function (claim) {
        claim.updatedAt = now();
        claim.totals = totals(claim.receipts);
        var ref = claim.id ? db.collection("claims").doc(claim.id) : db.collection("claims").doc();
        if (!claim.id) {
          claim.id = ref.id;
          claim.createdAt = now();
        }
        var data = clean(claim);
        delete data.id;
        return ref.set(data).then(function () { return claim; }).catch(function (e) { throw friendly(e); });
      },
      deleteClaim: function (id) {
        return db.collection("claims").doc(id).delete().catch(function (e) { throw friendly(e); });
      },
      act: function (claim, action, data) {
        if (!can(current, action, claim)) return Promise.reject(new Error("You can't do that on this claim."));
        return this.saveClaim(applyAction(claim, action, current, data));
      },
      savePhoto: function (claimId, dataUrl) {
        var ref = db.collection("claims").doc(claimId).collection("photos").doc();
        return ref.set({ data: dataUrl, ownerUid: current.uid, createdAt: now() })
          .then(function () { return ref.id; })
          .catch(function (e) { throw friendly(e); });
      },
      getPhoto: function (claimId, photoId) {
        if (!photoId) return Promise.resolve(null);
        return db.collection("claims").doc(claimId).collection("photos").doc(photoId).get()
          .then(function (s) { return s.exists ? s.data().data : null; })
          .catch(function () { return null; });
      },
      watchUsers: function (cb) {
        return db.collection("users").onSnapshot(function (snap) {
          cb(snap.docs.map(function (d) {
            var u = d.data();
            u.uid = d.id;
            return u;
          }));
        }, function () {
          cb([]);
        });
      },
      setUser: function (uid, fields) {
        return db.collection("users").doc(uid).update(fields).catch(function (e) { throw friendly(e); });
      }
    };
  }

  var cfg = window.EZ_CONFIG || {};
  var store = cfg.firebase && window.firebase ? FirebaseStore(cfg.firebase) : LocalStore();
  store.STATUS = STATUS;
  store.ROLE_LABELS = ROLE_LABELS;
  store.ACTIONS = ACTIONS;
  store.can = can;
  store.isStaff = isStaff;
  store.totals = totals;
  window.EZStore = store;
})();
