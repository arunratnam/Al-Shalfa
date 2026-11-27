/*
 * Data layer. Two interchangeable back ends with the same API:
 *   - DemoStore: everything on this device (localStorage + IndexedDB), with demo people.
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

  // ------------------------------------------------------------------ small IndexedDB helper (demo photos)

  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open("ezfuel-demo", 1);
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

  /** Draws a sample fuel receipt for the demo data (marked as a sample). */
  function demoReceipt(f) {
    var cv = document.createElement("canvas");
    cv.width = 420;
    cv.height = 620;
    var g = cv.getContext("2d");
    g.fillStyle = "#e9e6df";
    g.fillRect(0, 0, 420, 620);
    g.fillStyle = "#fffdf8";
    g.fillRect(40, 20, 340, 580);
    g.fillStyle = "#222";
    g.textAlign = "center";
    g.font = "bold 24px monospace";
    g.fillText(String(f[0]).toUpperCase(), 210, 80);
    g.font = "16px monospace";
    g.fillText("FUEL RECEIPT", 210, 110);
    g.fillText("-----------------------------", 210, 140);
    g.textAlign = "left";
    var rows = [["DATE", f[1]], ["PRODUCT", "SUPER 95"], ["LITRES", Number(f[2]).toFixed(2)], ["PRICE/L", (Number(f[3]) / Number(f[2])).toFixed(3) + " KD"], ["ODOMETER", f[4] + " KM"]];
    rows.forEach(function (r, i) {
      g.fillText(r[0], 70, 180 + i * 34);
      g.textAlign = "right";
      g.fillText(r[1], 350, 180 + i * 34);
      g.textAlign = "left";
    });
    g.textAlign = "center";
    g.fillText("-----------------------------", 210, 360);
    g.font = "bold 26px monospace";
    g.fillText("TOTAL  " + Number(f[3]).toFixed(3) + " KD", 210, 405);
    g.font = "15px monospace";
    g.fillText("PAID BY CARD", 210, 445);
    g.fillText("THANK YOU", 210, 520);
    g.fillStyle = "rgba(200,16,46,.75)";
    g.font = "bold 20px sans-serif";
    g.fillText("SAMPLE (DEMO DATA)", 210, 575);
    return cv.toDataURL("image/jpeg", 0.8);
  }

  // ------------------------------------------------------------------ Demo store

  function DemoStore() {
    var KEY = "ezfuel-demo-v1";
    var state = load();
    var authCbs = [], claimCbs = [], userCbs = [];
    var current = null;

    function load() {
      try {
        var s = JSON.parse(localStorage.getItem(KEY));
        if (s && s.users) return s;
      } catch (e) {}
      return seed();
    }

    function persist() {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {}
    }

    function emitClaims() {
      claimCbs.forEach(function (w) {
        w.cb(scoped(w.scope));
      });
    }

    function emitUsers() {
      userCbs.forEach(function (cb) {
        cb(state.users.slice());
      });
    }

    function scoped(scope) {
      var list = state.claims.filter(function (c) {
        return scope === "all" ? isStaff(current) && c.status !== "draft" : current && c.ownerUid === current.uid;
      });
      return list.sort(function (a, b) {
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
    }

    function seed() {
      var users = [
        { uid: "u-driver", name: "Ahmed Al-Rashid", email: "driver@example.com", employeeId: "EZ-1042", department: "Delivery", vehicle: "KWT 12-34567", role: "driver", active: true, sample: true },
        { uid: "u-driver2", name: "Ravi Kumar", email: "driver2@example.com", employeeId: "EZ-1077", department: "Logistics", vehicle: "KWT 45-11223", role: "driver", active: true, sample: true },
        { uid: "u-verifier", name: "Sara Office", email: "office@example.com", employeeId: "EZ-0210", department: "Administration", vehicle: "", role: "verifier", active: true, sample: true },
        { uid: "u-approver", name: "Khalid Manager", email: "manager@example.com", employeeId: "EZ-0101", department: "Operations", vehicle: "", role: "approver", active: true, sample: true },
        { uid: "u-admin", name: "Admin", email: "admin@example.com", employeeId: "EZ-0001", department: "Administration", vehicle: "", role: "admin", active: true, sample: true }
      ];
      var d = new Date();
      function day(offset) {
        var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
        return x.toISOString().slice(0, 10);
      }
      function r(off, station, odo, litres, amount) {
        return { id: "r" + Math.random().toString(36).slice(2, 8), date: day(off), station: station, odometer: odo, litres: litres, amount: amount,
          photoId: "demo:" + encodeURIComponent([station, day(off), litres, amount, odo].join("|")) };
      }
      var claims = [];
      function claim(no, owner, status, offsetFrom, receipts, extra) {
        var u = users.filter(function (x) { return x.uid === owner; })[0];
        var c = {
          id: "c" + no, claimNo: "EZ-FUEL-" + d.getFullYear() + "-" + ("000" + no).slice(-4), sample: true,
          ownerUid: owner, driverName: u.name, employeeId: u.employeeId, vehicle: u.vehicle, department: u.department,
          periodFrom: day(offsetFrom), periodTo: day(offsetFrom + 13), submissionDate: day(offsetFrom + 14),
          receipts: receipts, declaration: true, driverSignature: "", status: "draft",
          history: [], createdAt: now() - (60 - no) * 86400000, updatedAt: now() - (60 - no) * 86400000
        };
        c.totals = totals(receipts);
        var steps = { submitted: ["submit"], verified: ["submit", "verify"], approved: ["submit", "verify", "approve"],
          paid: ["submit", "verify", "approve", "pay"], returned: ["submit", "return"] }[status] || [];
        steps.forEach(function (s, i) {
          var actor = s === "submit" ? u : s === "verify" || s === "return" ? users[2] : users[3];
          c = applyAction(c, s, actor, s === "approve" ? { amountApproved: c.totals.amount } :
            s === "pay" ? { reference: "TRF-" + (8800 + no) } : s === "return" ? { note: "Receipt 2 photo is not readable. Please retake it." } : {});
          c.history[c.history.length - 1].at = c.createdAt + (i + 1) * 86400000;
        });
        for (var k in extra) c[k] = extra[k];
        claims.push(c);
      }
      claim(1, "u-driver", "paid", -50, [r(-50, "KNPC Salmiya", 84210, 42.5, 3.570), r(-45, "Oula Hawally", 84702, 40.1, 3.368), r(-40, "Alfa Fuel Shuwaikh", 85190, 44.0, 3.696)]);
      claim(2, "u-driver2", "approved", -35, [r(-35, "KNPC Jahra", 120400, 55.2, 4.637), r(-30, "Oula Sulaibiya", 121020, 51.7, 4.343)]);
      claim(3, "u-driver", "verified", -20, [r(-20, "KNPC Salmiya", 85690, 41.8, 3.511), r(-16, "Soor Fuel Farwaniya", 86160, 39.5, 3.318), r(-12, "Oula Hawally", 86655, 43.2, 3.629)]);
      claim(4, "u-driver2", "submitted", -14, [r(-14, "KNPC Jahra", 121600, 53.0, 4.452), r(-9, "Alfa Fuel Ardiya", 122180, 49.9, 4.192)]);
      claim(5, "u-driver", "returned", -10, [r(-10, "KNPC Fintas", 87120, 38.6, 3.242), r(-6, "Oula Mangaf", 87590, 42.0, 3.528)]);
      return { users: users, claims: claims, counter: 5 };
    }

    return {
      mode: "demo",
      ROLES: ROLES,
      init: function () {
        return Promise.resolve();
      },
      demoUsers: function () {
        return state.users.slice();
      },
      onAuth: function (cb) {
        authCbs.push(cb);
        var uid = sessionStorage.getItem("ezfuel-demo-uid");
        current = state.users.filter(function (u) { return u.uid === uid; })[0] || null;
        setTimeout(function () { cb(current); }, 0);
      },
      signInDemo: function (uid) {
        current = state.users.filter(function (u) { return u.uid === uid; })[0] || null;
        sessionStorage.setItem("ezfuel-demo-uid", uid);
        authCbs.forEach(function (cb) { cb(current); });
        return Promise.resolve(current);
      },
      signIn: function () {
        return Promise.reject(new Error("Demo mode: pick a person below to try the app."));
      },
      signUp: function () {
        return Promise.reject(new Error("Demo mode: accounts are created once Firebase is connected."));
      },
      resetPassword: function () {
        return Promise.reject(new Error("Demo mode has no passwords."));
      },
      signOut: function () {
        current = null;
        sessionStorage.removeItem("ezfuel-demo-uid");
        authCbs.forEach(function (cb) { cb(null); });
        return Promise.resolve();
      },
      updateProfile: function (fields) {
        for (var k in fields) current[k] = fields[k];
        persist();
        authCbs.forEach(function (cb) { cb(current); });
        return Promise.resolve(current);
      },
      watchClaims: function (scope, cb) {
        var w = { scope: scope, cb: cb };
        claimCbs.push(w);
        setTimeout(function () { cb(scoped(scope)); }, 0);
        return function () {
          claimCbs = claimCbs.filter(function (x) { return x !== w; });
        };
      },
      newClaimNo: function () {
        state.counter++;
        persist();
        return Promise.resolve("EZ-FUEL-" + new Date().getFullYear() + "-" + ("000" + state.counter).slice(-4));
      },
      saveClaim: function (claim) {
        claim.updatedAt = now();
        if (!claim.id) {
          claim.id = "c" + now();
          claim.createdAt = now();
        }
        claim.totals = totals(claim.receipts);
        var i = state.claims.map(function (c) { return c.id; }).indexOf(claim.id);
        if (i >= 0) state.claims[i] = claim;
        else state.claims.push(claim);
        persist();
        emitClaims();
        return Promise.resolve(claim);
      },
      deleteClaim: function (id) {
        state.claims = state.claims.filter(function (c) { return c.id !== id; });
        persist();
        emitClaims();
        return Promise.resolve();
      },
      act: function (claim, action, data) {
        if (!can(current, action, claim)) return Promise.reject(new Error("You can't do that on this claim."));
        var c = applyAction(claim, action, current, data);
        return this.saveClaim(c);
      },
      savePhoto: function (claimId, dataUrl) {
        var id = "p" + now() + Math.random().toString(36).slice(2, 6);
        return idbPut(id, dataUrl).then(function () { return id; });
      },
      getPhoto: function (claimId, photoId) {
        if (photoId && photoId.indexOf("demo:") === 0) return Promise.resolve(demoReceipt(decodeURIComponent(photoId.slice(5)).split("|")));
        return photoId ? idbGet(photoId) : Promise.resolve(null);
      },
      watchUsers: function (cb) {
        userCbs.push(cb);
        setTimeout(function () { cb(state.users.slice()); }, 0);
        return function () {
          userCbs = userCbs.filter(function (x) { return x !== cb; });
        };
      },
      setUser: function (uid, fields) {
        state.users.forEach(function (u) {
          if (u.uid === uid) for (var k in fields) u[k] = fields[k];
        });
        persist();
        emitUsers();
        return Promise.resolve();
      },
      resetDemo: function () {
        localStorage.removeItem(KEY);
        state = seed();
        persist();
        emitClaims();
        emitUsers();
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
  var store = cfg.firebase && window.firebase ? FirebaseStore(cfg.firebase) : DemoStore();
  store.STATUS = STATUS;
  store.ROLE_LABELS = ROLE_LABELS;
  store.ACTIONS = ACTIONS;
  store.can = can;
  store.isStaff = isStaff;
  store.totals = totals;
  window.EZStore = store;
})();
