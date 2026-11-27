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
            mileage: (extra && extra.mileage) || null,
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

  /**
   * Online store (Firebase Auth + Cloud Firestore). Drivers keep their own bills and claims;
   * the office (role "admin") sees everyone's. Photos are stored in Firestore so the free plan is enough.
   *   users/{uid}    profile, role (driver | admin), signature
   *   bills/{id}     ownerUid, date, station, odometer, litres, amount, photoId, claimId
   *   claims/{id}    ownerUid, claimNo, receipts, billIds, mileage, status (submitted | paid)
   *   photos/{id}    ownerUid, data (JPEG data URL)
   *   counters/{uid} next claim number for that driver
   */
  function FirebaseStore(cfg) {
    var auth, db;
    var current = null;
    var authCbs = [];

    function friendly(e) {
      var m = {
        "auth/invalid-credential": "Wrong email or password.",
        "auth/invalid-login-credentials": "Wrong email or password.",
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

    function clean(o) {
      return JSON.parse(JSON.stringify(o));
    }

    function list(snap) {
      return snap.docs.map(function (d) {
        var x = d.data();
        x.id = d.id;
        return x;
      });
    }

    function profileOf(user) {
      return db.collection("users").doc(user.uid).get().then(function (snap) {
        if (snap.exists) {
          var p = snap.data();
          p.uid = user.uid;
          return p;
        }
        var f = JSON.parse(sessionStorage.getItem("ezfuel-signup") || "{}");
        var p2 = {
          name: f.name || user.email.split("@")[0], email: user.email, employeeId: f.employeeId || "",
          department: f.department || "", vehicle: f.vehicle || "", role: "driver", active: false, pending: true, createdAt: now()
        };
        return db.collection("users").doc(user.uid).set(p2).then(function () {
          sessionStorage.removeItem("ezfuel-signup");
          p2.uid = user.uid;
          return p2;
        });
      });
    }

    function tellAuth() {
      authCbs.forEach(function (cb) { cb(current); });
    }

    var store = {
      mode: "firebase",
      ROLES: ["driver", "admin"],
      init: function () {
        firebase.initializeApp(cfg);
        auth = firebase.auth();
        db = firebase.firestore();
        if ((window.EZ_CONFIG || {}).useEmulators) {
          // local test database (developers only)
          auth.useEmulator("http://localhost:9099", { disableWarnings: true });
          db.useEmulator("localhost", 8080);
        }
        try {
          // keeps working without signal; changes upload when back online
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
            // follow changes to the account (e.g. the admin allows it) while the app is open
            if (store.unwatchMe) store.unwatchMe();
            store.unwatchMe = db.collection("users").doc(user.uid).onSnapshot(function (s) {
              if (!s.exists || !current || current.uid !== user.uid) return;
              var x = s.data();
              x.uid = user.uid;
              if (x.active !== current.active || x.role !== current.role || x.pending !== current.pending) {
                current = x;
                cb(x);
              } else {
                current = x;
              }
            }, function () {});
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
        if (store.unwatchMe) store.unwatchMe();
        store.unwatchMe = null;
        return auth.signOut();
      },
      updateProfile: function (f) {
        var allowed = {};
        ["name", "employeeId", "department", "vehicle", "signature"].forEach(function (k) { if (k in f) allowed[k] = f[k]; });
        return db.collection("users").doc(current.uid).update(allowed).then(function () {
          for (var k in allowed) current[k] = allowed[k];
          tellAuth();
          return current;
        }).catch(function (e) { throw friendly(e); });
      },

      // ---- live lists ----
      watchClaims: function (scope, cb) {
        var q = scope === "all" ? db.collection("claims") : db.collection("claims").where("ownerUid", "==", current.uid);
        return q.onSnapshot(function (snap) {
          cb(list(snap).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); }));
        }, function (e) { cb([], friendly(e)); });
      },
      watchBills: function (cb, scope) {
        var q = scope === "all" ? db.collection("bills") : db.collection("bills").where("ownerUid", "==", current.uid);
        return q.onSnapshot(function (snap) { cb(list(snap)); }, function (e) { cb([], friendly(e)); });
      },
      watchUsers: function (cb) {
        return db.collection("users").onSnapshot(function (snap) {
          cb(snap.docs.map(function (d) { var u = d.data(); u.uid = d.id; return u; }));
        }, function () { cb([]); });
      },
      setUser: function (uid, fields) {
        return db.collection("users").doc(uid).update(fields).catch(function (e) { throw friendly(e); });
      },

      // ---- bills ----
      saveBill: function (bill) {
        var b = clean(bill);
        var ref = b.id ? db.collection("bills").doc(b.id) : db.collection("bills").doc();
        if (!b.id) {
          b.createdAt = now();
          b.claimId = null;
          b.ownerUid = current.uid;
        }
        b.driverName = current.name;
        b.updatedAt = now();
        delete b.id;
        return ref.set(b).then(function () { b.id = ref.id; return b; }).catch(function (e) { throw friendly(e); });
      },
      deleteBill: function (id) {
        var ref = db.collection("bills").doc(id);
        return ref.get().then(function (s) {
          if (!s.exists) return;
          if (s.data().claimId) throw new Error("This bill is part of a claim. Delete the claim first.");
          var pid = s.data().photoId;
          return ref.delete().then(function () {
            if (pid) db.collection("photos").doc(pid).delete().catch(function () {});
          });
        }).catch(function (e) { throw e.code ? friendly(e) : e; });
      },

      // ---- claims ----
      newClaimNo: function () {
        var ref = db.collection("counters").doc(current.uid), year = new Date().getFullYear();
        var emp = String(current.employeeId || "").replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
        return db.runTransaction(function (tx) {
          return tx.get(ref).then(function (s) {
            var n = s.exists && s.data().year === year ? s.data().next : 1;
            tx.set(ref, { year: year, next: n + 1 });
            return n;
          });
        }).then(function (n) {
          return "FUEL-" + (emp ? emp + "-" : "") + year + "-" + ("00" + n).slice(-3);
        });
      },
      /** Creates the claim and marks its bills as claimed in one go. */
      createClaim: function (billIds, extra, bills) {
        var chosen = bills.filter(function (b) { return billIds.indexOf(b.id) >= 0 && !b.claimId; })
          .sort(function (a, b) { return (a.date || "").localeCompare(b.date || "") || (Number(a.odometer) || 0) - (Number(b.odometer) || 0); });
        if (!chosen.length) return Promise.reject(new Error("No bills to claim."));
        return this.newClaimNo().then(function (no) {
          var t = now(), ref = db.collection("claims").doc();
          var c = {
            claimNo: no, ownerUid: current.uid, driverName: current.name, employeeId: current.employeeId || "", department: current.department || "",
            vehicle: current.vehicle || "", periodFrom: chosen[0].date, periodTo: chosen[chosen.length - 1].date,
            submissionDate: new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 10),
            receipts: chosen.map(function (b) { return { id: b.id, date: b.date, station: b.station, odometer: b.odometer, litres: b.litres, amount: b.amount, photoId: b.photoId || "" }; }),
            billIds: chosen.map(function (b) { return b.id; }), declaration: true, driverSignature: (extra && extra.signature) || "",
            mileage: (extra && extra.mileage) || null, status: "submitted", submittedAt: t, createdAt: t, updatedAt: t,
            history: [{ status: "submitted", action: "submit", byUid: current.uid, byName: current.name, at: t, note: "" }]
          };
          c.totals = totals(c.receipts);
          var batch = db.batch();
          batch.set(ref, clean(c));
          chosen.forEach(function (b) { batch.update(db.collection("bills").doc(b.id), { claimId: ref.id, updatedAt: t }); });
          return batch.commit().then(function () { c.id = ref.id; return c; });
        }).catch(function (e) { throw e.code ? friendly(e) : e; });
      },
      /** Deleting a claim puts its bills back. */
      deleteClaim: function (id) {
        var ref = db.collection("claims").doc(id);
        return ref.get().then(function (s) {
          if (!s.exists) return;
          var batch = db.batch();
          (s.data().billIds || []).forEach(function (bid) { batch.update(db.collection("bills").doc(bid), { claimId: null, updatedAt: now() }); });
          batch.delete(ref);
          return batch.commit();
        }).catch(function (e) { throw friendly(e); });
      },
      act: function (claim, action, data) {
        var c = clean(claim), id = c.id;
        data = data || {};
        if (action === "approve") {
          // the admin checks the bills and approves: fills "Verified by" and "Approved by" on the form
          c.status = "approved";
          c.verifiedBy = c.approvedBy = current.name;
          c.verifiedByUid = c.approvedByUid = current.uid;
          c.verifiedAt = c.approvedAt = now();
          c.amountApproved = Number(data.amountApproved);
          c.approverSignature = data.signature || "";
          c.remarks = data.note || "";
        } else if (action === "return" || action === "reject") {
          c.status = action === "return" ? "returned" : "rejected";
          c.remarks = data.note || "";
        } else if (action === "markPaid") {
          c.status = "paid";
          c.paidAt = data.paidAt || now();
          c.paidAmount = Number(data.amount);
          c.paidRef = data.reference || "";
          c.paidBy = current.name;
        } else if (action === "reopen") {
          c.status = c.approvedAt ? "approved" : "submitted";
          delete c.paidAt;
          delete c.paidAmount;
          delete c.paidRef;
          delete c.paidBy;
        } else {
          return Promise.reject(new Error("Unknown action"));
        }
        c.updatedAt = now();
        c.history = c.history || [];
        c.history.push({ status: c.status, action: action, byUid: current.uid, byName: current.name, at: now(), note: data.note || "" });
        delete c.id;
        return db.collection("claims").doc(id).set(c).then(function () { c.id = id; return c; }).catch(function (e) { throw friendly(e); });
      },

      // ---- photos ----
      savePhoto: function (claimId, dataUrl) {
        var ref = db.collection("photos").doc();
        return ref.set({ data: dataUrl, ownerUid: current.uid, createdAt: now() }).then(function () { return ref.id; })
          .catch(function (e) { throw friendly(e); });
      },
      getPhoto: function (claimId, photoId) {
        if (!photoId) return Promise.resolve(null);
        return db.collection("photos").doc(photoId).get().then(function (s) { return s.exists ? s.data().data : null; })
          .catch(function () { return idbGet(photoId); });
      },

      // ---- one-time upload of what was saved on this phone before going online ----
      localData: function () {
        if (localStorage.getItem("ezfuel-uploaded")) return null;
        var bills = [], claims = [], counter = null;
        try {
          bills = JSON.parse(localStorage.getItem("ezfuel-bills")) || [];
          claims = JSON.parse(localStorage.getItem("ezfuel-claims")) || [];
          counter = JSON.parse(localStorage.getItem("ezfuel-counter"));
        } catch (e) {}
        claims = claims.filter(function (c) { return c.status !== "draft"; });
        return bills.length || claims.length ? { bills: bills, claims: claims, counter: counter } : null;
      },
      skipUpload: function () {
        localStorage.setItem("ezfuel-uploaded", "skipped");
      },
      uploadLocal: function (progress) {
        var data = this.localData();
        if (!data) return Promise.resolve(0);
        var photoMap = {}, billMap = {}, claimMap = {}, done = 0, total = data.bills.length + data.claims.length;
        function step() { done++; if (progress) progress(done, total); }
        var chain = Promise.resolve();
        data.bills.forEach(function (b) {
          chain = chain.then(function () {
            return (b.photoId ? idbGet(b.photoId) : Promise.resolve(null)).then(function (img) {
              if (!img) return null;
              var ref = db.collection("photos").doc();
              return ref.set({ data: img, ownerUid: current.uid, createdAt: now() }).then(function () { photoMap[b.photoId] = ref.id; });
            }).then(function () {
              var ref = db.collection("bills").doc();
              billMap[b.id] = ref.id;
              return ref.set({ ownerUid: current.uid, driverName: current.name, date: b.date, station: b.station || "", odometer: Number(b.odometer) || 0,
                litres: Number(b.litres) || 0, amount: Number(b.amount) || 0, photoId: photoMap[b.photoId] || "", claimId: null, createdAt: b.createdAt || now(), updatedAt: now() });
            }).then(step);
          });
        });
        data.claims.forEach(function (c) {
          chain = chain.then(function () {
            var ref = db.collection("claims").doc(), x = clean(c);
            delete x.id;
            x.ownerUid = current.uid;
            ["driverName:name", "employeeId:employeeId", "department:department", "vehicle:vehicle"].forEach(function (k) {
              var f = k.split(":");
              if (!x[f[0]]) x[f[0]] = current[f[1]] || "";
            });
            x.billIds = (c.billIds || []).map(function (id) { return billMap[id]; }).filter(Boolean);
            x.receipts = (c.receipts || []).map(function (r) { var y = clean(r); y.id = billMap[r.id] || r.id; y.photoId = photoMap[r.photoId] || ""; return y; });
            x.totals = totals(x.receipts);
            x.updatedAt = now();
            // only the office marks claims paid online: a claim paid on the phone comes in as waiting, with a note
            if (x.status !== "submitted") {
              x.history = (x.history || []).concat([{ status: "submitted", action: "upload", byUid: current.uid, byName: current.name, at: now(),
                note: "Uploaded from the phone. The driver had marked it paid" + (x.paidAmount ? " (" + Number(x.paidAmount).toFixed(3) + " KD)" : "") + "; the office should confirm." }]);
            }
            x.status = "submitted";
            delete x.paidAt;
            delete x.paidAmount;
            delete x.paidRef;
            delete x.paidBy;
            claimMap[c.id] = ref.id;
            var batch = db.batch();
            batch.set(ref, x);
            x.billIds.forEach(function (bid) { batch.update(db.collection("bills").doc(bid), { claimId: ref.id }); });
            return batch.commit().then(step);
          });
        });
        return chain.then(function () {
          var year = new Date().getFullYear();
          if (data.counter && data.counter.year === year) {
            return db.collection("counters").doc(current.uid).set({ year: year, next: data.counter.next });
          }
        }).then(function () {
          localStorage.setItem("ezfuel-uploaded", String(now()));
          return total;
        }).catch(function (e) { throw friendly(e); });
      }
    };
    return store;
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
