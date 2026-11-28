/* EZ Storage Fuel Expense app: screens and behaviour. */
(function () {
  "use strict";

  var S = window.EZStore, C = window.EZ_CONFIG, P = window.EZPdf;
  var LOCAL = S.mode === "local"; // one driver per phone, no server
  // Online, the office account (role "admin") sees every driver; drivers see their own bills.
  var $main, $nav;
  var st = {
    user: null, ready: false, mine: [], all: [], users: [], allError: null,
    unsub: [], filter: { status: "all", month: "all", driver: "all", q: "" }, officeTab: "queue",
    draft: null, step: 1, photoCache: {}, loginTab: "in", bills: [], allBills: [], office: { driver: "all", month: "all", timeStaff: "all" },
    att: [], allAtt: [], ot: [], allOt: [], pay: {}, settings: null
  };

  // ------------------------------------------------------------------ helpers

  function esc(s) {
    return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function kd(n) { return (Number(n) || 0).toFixed(3); }
  function lit(n) { return (Number(n) || 0).toFixed(2); }
  function today() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(String(iso).slice(0, 10) + "T00:00:00");
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  function fmtTime(ms) {
    if (!ms) return "";
    var d = new Date(ms);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  function monthKey(c) {
    var iso = c.submissionDate || c.periodTo || new Date(c.createdAt || Date.now()).toISOString();
    return String(iso).slice(0, 7);
  }
  function monthLabel(key) {
    var p = key.split("-");
    return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }
  function initials(name) {
    return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join("");
  }
  function statusChip(s) {
    var m = S.STATUS[s] || { label: s, tone: "muted" };
    return '<span class="status ' + m.tone + '">' + esc(m.label) + "</span>";
  }
  function amountOf(c) {
    return c.amountApproved !== undefined && c.amountApproved !== null && ["approved", "paid"].indexOf(c.status) >= 0
      ? Number(c.amountApproved) : (c.totals ? c.totals.amount : 0);
  }
  // Online roles: driver (staff) < supervisor (verifies) < manager (approves, pays) < admin (also manages people)
  function role() { return !LOCAL && st.user ? st.user.role || "driver" : "driver"; }
  function isAdmin() { return role() === "admin"; }
  function isOffice() { return ["supervisor", "manager", "admin"].indexOf(role()) >= 0; }
  function canApprove() { return role() === "manager" || role() === "admin"; }
  /** What the signed-in person may do with a claim (never on their own claim). */
  function claimActions(c) {
    var a = [];
    if (LOCAL || !isOffice() || c.ownerUid === st.user.uid) return a;
    if (c.status === "submitted") a.push("verify");
    if ((c.status === "submitted" || c.status === "verified") && canApprove()) a.push("approve");
    if (c.status === "submitted" || (c.status === "verified" && canApprove())) a.push("return");
    if ((c.status === "submitted" || c.status === "verified") && canApprove()) a.push("reject");
    if (c.status === "approved" && canApprove()) a.push("pay");
    if (c.status === "paid" && canApprove()) a.push("reopen");
    return a;
  }
  function myHref(page) { return isOffice() ? "#/my-" + page : "#/" + page; }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }
  function isStaff() { return isOffice(); }
  function go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function findClaim(id) {
    return st.mine.concat(st.all).filter(function (c) { return c.id === id; })[0] || null;
  }

  var ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    office: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
    fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3M7 7h5v4H7z"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/></svg>',
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>'
  };

  // ------------------------------------------------------------------ files: download / share

  function blobToBase64(blob) {
    return new Promise(function (res) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1]); };
      r.readAsDataURL(blob);
    });
  }

  function saveFile(blob, filename) {
    // Inside a Claude artifact, files are saved through the viewer.
    if (window.claude && window.claude.use) {
      return window.claude.use("downloads").then(function (d) {
        if (!d) return anchorSave(blob, filename);
        return d.save({ filename: filename, data: blob }).then(function () {
          toast("Saved " + filename);
        }).catch(function (e) {
          toast(e && e.code === "declined" ? "Download cancelled" : "Couldn't save the file here. Open the app in a browser to download.");
        });
      });
    }
    return anchorSave(blob, filename);
  }

  /** iPhone / iPad: a Home Screen app has no back button, so files go through the share sheet ("Save to Files"). */
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function anchorSave(blob, filename) {
    if (isIOS() && !window.EZAndroid) {
      var f;
      try { f = new File([blob], filename, { type: blob.type }); } catch (e) { f = null; }
      if (f && navigator.canShare && navigator.canShare({ files: [f] })) {
        return navigator.share({ files: [f], title: filename }).catch(function () {});
      }
    }
    if (window.EZAndroid && window.EZAndroid.saveFile) {
      return blobToBase64(blob).then(function (b64) {
        var ok = window.EZAndroid.saveFile(b64, filename, blob.type || "application/octet-stream");
        toast(ok ? "Saved to Downloads: " + filename : "Couldn't save the file.");
      });
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    toast("Downloading " + filename);
    return Promise.resolve();
  }

  function shareFile(blob, filename, title) {
    if (window.EZAndroid && window.EZAndroid.shareFile) {
      return blobToBase64(blob).then(function (b64) {
        if (window.EZAndroid.shareWhatsApp) window.EZAndroid.shareWhatsApp(b64, filename, blob.type);
        else window.EZAndroid.shareFile(b64, filename, blob.type);
      });
    }
    var file;
    try { file = new File([blob], filename, { type: blob.type }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: title }).catch(function () {});
    }
    return saveFile(blob, filename);
  }

  function canShare() {
    if (window.EZAndroid && window.EZAndroid.shareFile) return true;
    if (window.claude) return false; // sharing is blocked inside an artifact
    try {
      return !!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] }));
    } catch (e) {
      return false;
    }
  }

  function getPhoto(claimId, photoId) {
    if (!photoId) return Promise.resolve(null);
    if (st.photoCache[photoId]) return Promise.resolve(st.photoCache[photoId]);
    return S.getPhoto(claimId, photoId).then(function (d) {
      if (d) st.photoCache[photoId] = d;
      return d;
    });
  }

  function makePdf(claim) {
    toast("Preparing PDF…");
    return Promise.all((claim.receipts || []).map(function (r) { return getPhoto(claim.id, r.photoId); }))
      .then(function (photos) {
        var withMileage = JSON.parse(JSON.stringify(claim));
        withMileage.mileage = claimMileage(claim);
        var doc = P.build(withMileage, photos, C, S.STATUS);
        return doc.output("blob");
      });
  }

  function pdfName(c) {
    return (c.claimNo || "Fuel-claim") + " " + (c.driverName || "").replace(/[^\w\- ]+/g, "").trim() + ".pdf";
  }

  // ------------------------------------------------------------------ photos & signature

  function compressImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1400, w = img.naturalWidth, h = img.naturalHeight;
        var s = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement("canvas");
        cv.width = Math.round(w * s);
        cv.height = Math.round(h * s);
        var g = cv.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        var q = 0.72, out = cv.toDataURL("image/jpeg", q);
        while (out.length > 850000 && q > 0.3) {
          q -= 0.12;
          out = cv.toDataURL("image/jpeg", q);
        }
        res(out);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        rej(new Error("That file isn't a photo the app can read. Try a JPG or PNG."));
      };
      img.src = url;
    });
  }

  function signaturePad(host) {
    var cv = host.querySelector("canvas");
    var g = cv.getContext("2d");
    var drawn = false, last = null;
    function size() {
      var r = cv.getBoundingClientRect(), k = window.devicePixelRatio || 1;
      cv.width = Math.round(r.width * k);
      cv.height = Math.round(r.height * k);
      g.setTransform(k, 0, 0, k, 0, 0);
      g.lineWidth = 2.4;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = "#0b1a3a";
    }
    size();
    function pt(e) {
      var r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    cv.addEventListener("pointerdown", function (e) {
      cv.setPointerCapture(e.pointerId);
      last = pt(e);
      g.beginPath();
      g.arc(last.x, last.y, 1.1, 0, 7);
      g.fillStyle = "#0b1a3a";
      g.fill();
      drawn = true;
      host.querySelector(".ph").hidden = true;
    });
    cv.addEventListener("pointermove", function (e) {
      if (!last) return;
      var p = pt(e);
      g.beginPath();
      g.moveTo(last.x, last.y);
      g.lineTo(p.x, p.y);
      g.stroke();
      last = p;
    });
    function up() { last = null; }
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    return {
      clear: function () {
        g.clearRect(0, 0, cv.width, cv.height);
        drawn = false;
        host.querySelector(".ph").hidden = false;
      },
      isEmpty: function () { return !drawn; },
      toDataURL: function () {
        // trim to the drawn area and scale to a small PNG
        var data = g.getImageData(0, 0, cv.width, cv.height).data, minX = cv.width, minY = cv.height, maxX = 0, maxY = 0;
        for (var y = 0; y < cv.height; y += 2) {
          for (var x = 0; x < cv.width; x += 2) {
            if (data[(y * cv.width + x) * 4 + 3] > 0) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX <= minX) return "";
        var pad = 8, w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
        var s = Math.min(1, 420 / w);
        var out = document.createElement("canvas");
        out.width = Math.round(w * s);
        out.height = Math.round(h * s);
        out.getContext("2d").drawImage(cv, minX - pad, minY - pad, w, h, 0, 0, out.width, out.height);
        return out.toDataURL("image/png");
      }
    };
  }

  // ------------------------------------------------------------------ sheet (dialog)

  function sheet(html, onReady) {
    var scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + "</div>";
    document.body.appendChild(scrim);
    function close() {
      scrim.remove();
      refresh(); // updates that arrived while the dialog was open
    }
    scrim.addEventListener("click", function (e) {
      if (e.target === scrim || e.target.closest("[data-close]")) close();
    });
    if (onReady) onReady(scrim.querySelector(".sheet"), close);
    var f = scrim.querySelector("input:not([type=checkbox]):not([type=file]), textarea");
    if (f && !("ontouchstart" in window)) f.focus();
    return close;
  }

  // ------------------------------------------------------------------ shell

  function renderNav() {
    if (!st.user) {
      $nav.hidden = true;
      return;
    }
    $nav.hidden = false;
    var r = (location.hash || "#/home").split("/")[1] || "home";
    var items;
    if (isOffice()) {
      items = [["home", "Dashboard", ICON.office], ["time", "Time", ICON.clock], ["claims", "Fuel", ICON.fuel]];
      if (isAdmin()) items.push(["payroll", "Payroll", ICON.money]);
      items.push(["mine", "Me", ICON.user]);
      if (isAdmin()) items.push(["users", "People", ICON.users]);
    } else if (LOCAL) {
      items = [["home", "Home", ICON.home], ["bills", "Bills", ICON.fuel], ["add", "Add bill", '<span class="plus">' + ICON.plus + "</span>"],
        ["claims", "Claims", ICON.list], ["reports", "Monthly", ICON.office]];
    } else if (true) {
      items = [["home", "Home", ICON.home], ["time", "My time", ICON.clock], ["add", "Add bill", '<span class="plus">' + ICON.plus + "</span>"],
        ["bills", "Bills", ICON.fuel], ["claims", "Claims", ICON.list]];
    } else {
      items = [["home", "Home", ICON.home], ["claims", "My claims", ICON.list], ["new", "New claim", '<span class="plus">' + ICON.plus + "</span>"]];
      if (isStaff()) items.push(["office", "Office", ICON.office]);
      if (st.user.role === "admin") items.push(["users", "Staff", ICON.users]);
      items.push(["profile", "Profile", ICON.user]);
    }
    $nav.innerHTML = items.map(function (it) {
      var on = r === it[0] || (it[0] === "claims" && r === "claim") || (it[0] === "office" && r === "review");
      if (it[0] === "claims" && r === "make-claim" && !isOffice()) on = true;
      if (it[0] === "mine" && ["bills", "make-claim", "my-claims", "my-reports", "my-time"].indexOf(r) >= 0) on = true;
      if (it[0] === "claims" && isOffice() && ["all-bills", "reports", "review", "claim"].indexOf(r) >= 0) on = true;
      if (it[0] === "users" && r === "settings") on = true;
      return '<a href="#/' + it[0] + '" class="' + (on ? "on " : "") + (it[0] === "new" || it[0] === "add" ? "new" : "") + '">' + it[2] + "<span>" + it[1] + "</span></a>";
    }).join("");
  }

  function renderTop() {
    var top = document.getElementById("topbar");
    if (!st.user) {
      top.hidden = true;
      return;
    }
    top.hidden = false;
    top.innerHTML = '<img class="logo" src="img/logo.png" alt="EZ Storage">' +
      '<div class="title"><b>EZ Staff</b><span>' + esc(st.user.name) + " · " + esc(isOffice() ? S.ROLE_LABELS[role()] || role() : st.user.vehicle || "") + "</span></div>" +
      '<a class="avatar" href="#/profile" aria-label="Your profile">' + esc(initials(st.user.name)) + "</a>";
  }

  // ------------------------------------------------------------------ login

  function viewLogin() {
    var demo = S.mode === "demo";
    var h = '<div class="login"><div class="box"><div class="brand"><img src="img/logo.png" alt="EZ Storage">' +
      "<h1>Fuel Expense Claims</h1><p class=\"sub\" style=\"margin:4px 0 0\">Submit fuel receipts, track approval and get reimbursed.</p></div>";
    if (demo) {
      h += '<div class="banner warn" style="margin-bottom:14px">Demo mode: the app isn\'t connected to the company database yet. Pick a person to try it. Data stays on this device.</div><div class="stack">';
      S.demoUsers().forEach(function (u) {
        h += '<button class="person" data-act="demo-login" data-uid="' + esc(u.uid) + '"><span class="avatar">' + esc(initials(u.name)) + '</span><span class="grow"><b>' + esc(u.name) + "</b><span>" + esc(S.ROLE_LABELS[u.role]) + (u.role === "driver" ? " · " + esc(u.vehicle) : "") + "</span></span></button>";
      });
      h += "</div></div></div>";
      return h;
    }
    var t = st.loginTab;
    h += '<div class="card"><div class="tabs"><button data-act="login-tab" data-tab="in" class="' + (t === "in" ? "on" : "") + '">Sign in</button><button data-act="login-tab" data-tab="up" class="' + (t === "up" ? "on" : "") + '">Create account</button></div>';
    h += '<form id="auth-form" class="stack" novalidate>';
    if (t === "up") {
      h += field("name", "Full name", "text", "", 'autocomplete="name" required') +
        '<div class="grid2">' + field("employeeId", "Employee ID", "text", "", "required") + selectField("department", "Department", C.departments, "") + "</div>" +
        field("vehicle", "Vehicle number", "text", "", 'placeholder="e.g. KWT 12-34567"');
    }
    h += field("email", "Work email", "email", "", 'autocomplete="email" required inputmode="email"') +
      field("password", "Password", "password", "", 'autocomplete="' + (t === "up" ? "new-password" : "current-password") + '" required minlength="6"') +
      '<div id="auth-msg" class="banner bad" hidden></div>' +
      '<button class="btn primary block" type="submit">' + (t === "up" ? "Create account" : "Sign in") + "</button>" +
      (t === "in" ? '<button type="button" class="link" data-act="forgot">Forgot password?</button>' : '<p class="sub" style="margin:0;font-size:13px">New accounts start as Driver. An administrator can give office roles.</p>') +
      "</form></div></div></div>";
    return h;
  }

  function field(name, label, type, value, extra) {
    return '<div class="field" data-f="' + name + '"><label for="f-' + name + '">' + esc(label) + '</label><input id="f-' + name + '" name="' + name + '" type="' + type + '" value="' + esc(value) + '" ' + (extra || "") + "></div>";
  }
  function selectField(name, label, options, value) {
    var opts = options.slice();
    if (value && opts.indexOf(value) < 0) opts.unshift(value);
    return '<div class="field" data-f="' + name + '"><label for="f-' + name + '">' + esc(label) + '</label><select id="f-' + name + '" name="' + name + '"><option value="">Choose…</option>' +
      opts.map(function (o) { return "<option" + (o === value ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select></div>";
  }

  // ------------------------------------------------------------------ home

  function kpi(label, value, unit, note, accent) {
    return '<div class="kpi' + (accent ? " accent" : "") + '"><div class="label">' + esc(label) + '</div><div class="value">' + value + (unit ? "<small>" + unit + "</small>" : "") + "</div>" + (note ? '<div class="note">' + note + "</div>" : "") + "</div>";
  }

  function sum(list, fn) {
    return list.reduce(function (a, c) { return a + (fn ? fn(c) : amountOf(c)); }, 0);
  }

  function claimItem(c, staffView, showDriver) {
    var who = staffView || showDriver ? esc(c.driverName) + " · " : "";
    var t = c.totals || { count: 0, amount: 0 };
    return '<a class="item" href="#/' + (staffView ? "review" : "claim") + "/" + esc(c.id) + '"><div class="main"><b>' + who + esc(c.claimNo || "Draft claim") + "</b><span>" +
      esc(fmtDate(c.periodFrom)) + " – " + esc(fmtDate(c.periodTo)) + " · " + plural(t.count, "bill") +
      (c.sample ? " · Example" : "") + '</span></div><div class="side"><span class="amt">' + kd(amountOf(c)) + ' KD</span>' + statusChip(c.status) + "</div></a>";
  }

  function viewHome() {
    if (isOffice()) return viewOfficeOnline();
    return viewHomeLocal();
    var mine = st.mine, now = new Date(), month = now.toISOString().slice(0, 7);
    var waiting = mine.filter(function (c) { return c.status === "submitted" || c.status === "verified"; });
    var toPay = mine.filter(function (c) { return c.status === "approved"; });
    var paidMonth = mine.filter(function (c) { return c.status === "paid" && c.paidAt && new Date(c.paidAt).toISOString().slice(0, 7) === month; });
    var year = mine.filter(function (c) { return c.status !== "draft" && c.status !== "rejected" && monthKey(c).slice(0, 4) === String(now.getFullYear()); });
    var attention = mine.filter(function (c) { return c.status === "returned" || c.status === "draft"; });
    var first = (st.user.name || "").split(" ")[0];

    var h = "<h1>Hello, " + esc(first) + '</h1><p class="sub">' + now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) + "</p>";
    h += '<a class="cta" href="#/new"><span class="ic">' + ICON.fuel + "</span><span><b>New fuel claim</b><span>Add receipts, sign and submit for approval</span></span></a>";

    if (isStaff()) {
      var q = officeQueue();
      h += '<div class="section-title"><h2>Office queue</h2><a href="#/office">Open dashboard</a></div><div class="kpis">' +
        kpi("To verify", q.verify.length, "", kd(sum(q.verify)) + " KD", q.verify.length && st.user.role !== "approver") +
        kpi("To approve", q.approve.length, "", kd(sum(q.approve)) + " KD", q.approve.length && st.user.role !== "verifier") +
        kpi("To pay", q.pay.length, "", kd(sum(q.pay)) + " KD") +
        kpi("Paid this month", kd(sum(st.all.filter(function (c) { return c.status === "paid" && c.paidAt && new Date(c.paidAt).toISOString().slice(0, 7) === month; }))), "KD") + "</div>";
    }

    h += '<div class="section-title"><h2>My reimbursements</h2></div><div class="kpis">' +
      kpi("Waiting for approval", kd(sum(waiting)), "KD", waiting.length + (waiting.length === 1 ? " claim" : " claims")) +
      kpi("Approved, to be paid", kd(sum(toPay)), "KD", toPay.length + (toPay.length === 1 ? " claim" : " claims")) +
      kpi("Paid this month", kd(sum(paidMonth)), "KD", paidMonth.length + (paidMonth.length === 1 ? " claim" : " claims")) +
      kpi("This year", kd(sum(year)), "KD", lit(sum(year, function (c) { return c.totals ? c.totals.litres : 0; })) + " litres") + "</div>";

    if (attention.length) {
      h += '<div class="section-title"><h2>Needs your action</h2></div><div class="card flush list">' + attention.map(function (c) { return claimItem(c); }).join("") + "</div>";
    }
    var recent = mine.filter(function (c) { return attention.indexOf(c) < 0; }).slice(0, 5);
    h += '<div class="section-title"><h2>Recent claims</h2><a href="#/claims">See all</a></div>';
    h += recent.length ? '<div class="card flush list">' + recent.map(function (c) { return claimItem(c); }).join("") + "</div>"
      : '<div class="card empty"><b>No claims yet</b>Tap "New fuel claim" to submit your first receipts.</div>';
    return h;
  }

  function viewHomeLocal() {
    var mine = st.mine, now = new Date(), month = monthOf(today());
    var waiting = mine.filter(function (c) { return c.status === "submitted" || c.status === "verified" || c.status === "approved"; });
    var returned = mine.filter(function (c) { return c.status === "returned"; });
    var paidMonth = mine.filter(function (c) { return c.status === "paid" && c.paidAt && monthOf(new Date(c.paidAt).toISOString()) === month; });
    var all = billsWithMileage(), open = all.filter(function (b) { return !b.claimId; });
    var thisMonth = all.filter(function (b) { return monthOf(b.date) === month; });
    var first = (st.user.name || "").split(" ")[0];
    var n = open.length, need = CLAIM_SIZE;
    var cur = open.slice(0, need), m = mileageOf(cur);
    var curAmount = sum(cur, function (b) { return Number(b.amount) || 0; }), curLitres = sum(cur, function (b) { return Number(b.litres) || 0; });
    var last = mine.filter(function (c) { return c.status !== "draft"; }).sort(function (x, y) { return (y.submittedAt || 0) - (x.submittedAt || 0); })[0];
    var h = "<h1>Hello, " + esc(first) + '</h1><p class="sub">' + now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) + "</p>" + uploadBanner() + attendanceCard();
    if (!LOCAL) h += '<div class="section-title" style="margin-top:18px"><h2>Fuel</h2></div>';

    // the bills collected for the next claim, counted separately from claimed / paid bills
    var pct = Math.min(100, Math.round(n / need * 100));
    h += '<div class="card stack progress-card"><div class="spread"><div><div class="eyebrow">Next claim · new bills</div><div class="big num">' + Math.min(n, need) + "<small> / " + need + " bills</small></div></div>" +
      (n >= need ? '<span class="status good">Ready to claim</span>' : '<span class="status muted">' + (need - n) + " more needed</span>") + "</div>" +
      '<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="' + need + '" aria-valuenow="' + Math.min(n, need) + '"><span style="width:' + pct + '%"></span></div>' +
      (n ? '<div class="mini"><div><span>Amount</span><b>' + kd(curAmount) + " KD</b></div><div><span>Distance</span><b>" + (m && m.km ? m.km.toLocaleString() + " km" : "—") + "</b></div>" +
        "<div><span>Litres</span><b>" + lit(curLitres) + "</b></div><div><span>Mileage</span><b>" + (m && m.kmpl ? m.kmpl.toFixed(1) + " km/L" : "—") + "</b></div></div>" : "") +
      (n >= need
        ? '<p class="sub" style="margin:0">' + need + " bills are ready. Create the claim and send the PDF on WhatsApp.</p>" +
          '<div class="btn-row"><a class="btn primary" href="#/make-claim">Create claim</a><button class="btn" data-act="add-bill">' + ICON.camera + "Add fuel bill</button></div>"
        : '<p class="sub" style="margin:0">' + (n ? "Bills added since your last claim." : last ? "Your last claim is done. Start adding bills for the next one." : "Add each fuel bill when you fill up.") +
          " After " + need + " bills you can make a claim.</p>" +
          '<button class="btn primary block" data-act="add-bill">' + ICON.camera + "Add fuel bill</button>") + "</div>";

    // claims already made
    h += '<div class="section-title"><h2>My claims</h2><a href="' + myHref("claims") + '">See all</a></div><div class="kpis">' +
      kpi(LOCAL ? "Waiting for payment" : "Waiting (approval / payment)", kd(sum(waiting)), "KD", plural(waiting.length, "claim"), waiting.length > 0) +
      kpi("Paid this month", kd(sum(paidMonth, paidAmt)), "KD", plural(paidMonth.length, "claim")) + "</div>";
    if (returned.length) {
      h += '<div class="banner warn" style="margin-top:10px"><b>' + plural(returned.length, "claim") + " returned by the admin.</b> Open it to see why.</div>" +
        '<div class="card flush list" style="margin-top:10px">' + returned.map(function (c) { return claimItem(c); }).join("") + "</div>";
    } else if (last) {
      h += '<div class="card flush list" style="margin-top:10px">' + claimItem(last) + "</div>";
    }

    // the whole month, claimed and new bills together
    h += '<div class="section-title"><h2>This month · all bills</h2><a href="' + myHref("reports") + "/" + month + '">Monthly report</a></div><div class="kpis">' +
      kpi("Distance driven", sum(thisMonth, function (b) { return b.distance || 0; }).toLocaleString(), "km", plural(thisMonth.length, "bill")) +
      kpi("Fuel cost", kd(sum(thisMonth, function (b) { return Number(b.amount) || 0; })), "KD", lit(sum(thisMonth, function (b) { return Number(b.litres) || 0; })) + " litres") + "</div>";

    var recent = open.slice().reverse().slice(0, 5);
    h += '<div class="section-title"><h2>New bills (not claimed yet)</h2><a href="#/bills">All bills</a></div>';
    h += recent.length ? '<div class="card flush">' + recent.map(billRow).join("") + "</div>"
      : '<div class="card empty"><b>No new bills</b>Tap "Add fuel bill" after you fill up, and take a photo of the bill.</div>';
    return h;
  }

  function paidAmt(c) {
    return c.paidAmount !== undefined && c.paidAmount !== null && !isNaN(c.paidAmount) ? Number(c.paidAmount) : amountOf(c);
  }

  // ------------------------------------------------------------------ my claims

  function viewClaims() {
    if (isOffice() && (location.hash || "").indexOf("#/my-claims") !== 0) return viewAllClaims();
    var f = st.filter.status;
    var keys = ["all", "draft", "submitted", "verified", "approved", "paid", "returned", "rejected"];
    var counts = {};
    st.mine.forEach(function (c) { counts[c.status] = (counts[c.status] || 0) + 1; });
    var list = st.mine.filter(function (c) { return f === "all" || c.status === f; });
    var h = '<h1>My claims</h1><p class="sub">' + plural(st.mine.length, "claim") + " · " + kd(sum(st.mine.filter(function (c) { return c.status === "paid"; }))) + ' KD reimbursed</p><div class="chips" style="margin-bottom:14px">';
    keys.forEach(function (k) {
      if (k !== "all" && !counts[k]) return;
      h += '<button class="chip' + (f === k ? " on" : "") + '" data-act="filter-status" data-v="' + k + '">' + (k === "all" ? "All" : S.STATUS[k].label) + '<span class="n">' + (k === "all" ? st.mine.length : counts[k]) + "</span></button>";
    });
    h += "</div>";
    h += list.length ? '<div class="card flush list">' + list.map(function (c) { return claimItem(c); }).join("") + "</div>"
      : '<div class="card empty"><b>Nothing here</b>No claims with this status.</div>';
    return h;
  }

  // ------------------------------------------------------------------ claim detail (driver & office)

  function tracker(c) {
    var steps = [["Submitted", c.submittedAt], ["Verified", c.verifiedAt], ["Approved", c.approvedAt], ["Paid", c.paidAt]];
    var reached = { submitted: 1, verified: 2, approved: 3, paid: 4 }[c.status];
    var stopped = c.status === "returned" || c.status === "rejected";
    if (stopped) reached = c.verifiedAt ? 2 : 1;
    return '<div class="track">' + steps.map(function (s, i) {
      var n = i + 1, cls = n <= reached ? "done" : (!stopped && n === reached + 1 ? "now" : "");
      return '<div class="step ' + cls + '"><div class="bar"></div>' + s[0] + "<small>" + (n <= reached && s[1] ? esc(fmtTime(s[1])) : n === reached + 1 && !stopped ? "Waiting" : "&nbsp;") + "</small></div>";
    }).join("") + "</div>";
  }

  function receiptWarnings(receipts, c) {
    // odometer should rise with the date; dates should sit inside the period
    var w = {};
    var sorted = receipts.map(function (r, i) { return { r: r, i: i }; }).sort(function (a, b) { return (a.r.date || "").localeCompare(b.r.date || ""); });
    for (var k = 1; k < sorted.length; k++) {
      if (Number(sorted[k].r.odometer) && Number(sorted[k - 1].r.odometer) && Number(sorted[k].r.odometer) <= Number(sorted[k - 1].r.odometer)) {
        w[sorted[k].i] = "Odometer is not higher than the previous fill-up.";
      }
    }
    receipts.forEach(function (r, i) {
      if (c && c.periodFrom && r.date && (r.date < c.periodFrom || (c.periodTo && r.date > c.periodTo))) w[i] = (w[i] ? w[i] + " " : "") + "Date is outside the submission period.";
      if (Number(r.litres) > 0 && Number(r.amount) > 0) {
        var ppl = Number(r.amount) / Number(r.litres);
        if (ppl > 0.25 || ppl < 0.05) w[i] = (w[i] ? w[i] + " " : "") + "Price per litre looks unusual (" + ppl.toFixed(3) + " KD).";
      }
    });
    return w;
  }

  function efficiency(receipts) {
    var s = receipts.filter(function (r) { return Number(r.odometer); }).slice().sort(function (a, b) { return Number(a.odometer) - Number(b.odometer); });
    if (s.length < 2) return null;
    var km = Number(s[s.length - 1].odometer) - Number(s[0].odometer);
    var litres = s.slice(1).reduce(function (a, r) { return a + (Number(r.litres) || 0); }, 0);
    return km > 0 && litres > 0 ? { km: km, kmpl: km / litres } : null;
  }

  function receiptsBlock(c, editable) {
    var rs = c.receipts || [];
    if (!rs.length) return '<div class="card empty"><b>No receipts yet</b>' + (editable ? "Tap \"Add receipt\" to add your first fuel receipt." : "") + "</div>";
    var warn = receiptWarnings(rs, c);
    return '<div class="card flush">' + rs.map(function (r, i) {
      return '<div class="receipt"><span class="no">' + (i + 1) + '</span><button class="thumb" data-act="view-photo" data-claim="' + esc(c.id || "") + '" data-photo="' + esc(r.photoId || "") + '" data-thumb="' + esc(r.photoId || "") + '" aria-label="View receipt ' + (i + 1) + ' photo">' + (r.photoId ? "" : "No photo") + "</button>" +
        '<div class="main"><b>' + esc(r.station || "—") + "</b><span>" + esc(fmtDate(r.date)) + " · " + esc(r.odometer ? Number(r.odometer).toLocaleString() + " km" : "no odometer") + "</span>" +
        (warn[i] ? '<div class="warnline">⚠ ' + esc(warn[i]) + "</div>" : "") + '</div><div class="amt">' + kd(r.amount) + " KD<small>" + lit(r.litres) + " L</small></div>" +
        (editable ? '<div class="row" style="flex-direction:column;gap:2px"><button class="btn small" data-act="edit-receipt" data-i="' + i + '">Edit</button></div>' : "") + "</div>";
    }).join("") + "</div>";
  }

  function totalsBar(c) {
    var t = S.totals(c.receipts);
    return '<div class="card flush totals"><div><span>Receipts</span><b>' + t.count + "</b></div><div><span>Litres</span><b>" + lit(t.litres) + "</b></div><div><span>Total</span><b>" + kd(t.amount) + " KD</b></div></div>";
  }

  function viewClaim(id, staffView) {
    return viewClaimLocal(id);
    var c = findClaim(id);
    if (!c) return '<div class="card empty"><b>Claim not found</b>It may have been deleted. <a href="#/home">Go home</a></div>';
    var u = st.user, eff = efficiency(c.receipts || []);
    var h = '<div class="spread" style="margin-bottom:4px"><h1>' + esc(c.claimNo || "Draft claim") + "</h1>" + statusChip(c.status) + "</div>" +
      '<p class="sub">' + esc(c.driverName) + " · " + esc(c.vehicle || "No vehicle") + (c.sample ? " · Example data" : "") + "</p>";

    if (c.status === "returned") h += '<div class="banner warn" style="margin-bottom:14px"><b>Returned for correction.</b> ' + esc(c.remarks || "") + "</div>";
    if (c.status === "rejected") h += '<div class="banner bad" style="margin-bottom:14px"><b>Rejected.</b> ' + esc(c.remarks || "") + "</div>";
    if (c.status === "paid") h += '<div class="banner good" style="margin-bottom:14px"><b>Paid ' + kd(c.amountApproved) + " KD</b> on " + esc(fmtTime(c.paidAt)) + (c.paidRef ? " · Ref. " + esc(c.paidRef) : "") + "</div>";
    if (c.status !== "draft") h += '<div class="card" style="margin-bottom:14px">' + tracker(c) + "</div>";

    // actions
    var acts = [];
    if (c.ownerUid === u.uid && (c.status === "draft" || c.status === "returned")) acts.push('<a class="btn primary" href="#/edit/' + esc(c.id) + '">' + (c.status === "draft" ? "Continue claim" : "Fix and resubmit") + "</a>");
    if (S.can(u, "verify", c)) acts.push('<button class="btn good" data-act="do" data-a="verify" data-id="' + esc(c.id) + '">Verify</button>');
    if (S.can(u, "approve", c)) acts.push('<button class="btn good" data-act="do" data-a="approve" data-id="' + esc(c.id) + '">Approve</button>');
    if (S.can(u, "pay", c)) acts.push('<button class="btn good" data-act="do" data-a="pay" data-id="' + esc(c.id) + '">Mark as paid</button>');
    if (S.can(u, "return", c)) acts.push('<button class="btn warn" data-act="do" data-a="return" data-id="' + esc(c.id) + '">Return to driver</button>');
    if (S.can(u, "reject", c)) acts.push('<button class="btn bad" data-act="do" data-a="reject" data-id="' + esc(c.id) + '">Reject</button>');
    acts.push('<button class="btn" data-act="pdf" data-id="' + esc(c.id) + '">' + ICON.pdf + "Download PDF</button>");
    if (canShare()) acts.push('<button class="btn" data-act="share" data-id="' + esc(c.id) + '">' + ICON.share + "Share PDF</button>");
    h += '<div class="btn-row" style="margin-bottom:6px">' + acts.join("") + "</div>";

    h += '<div class="section-title"><h2>Details</h2></div><div class="card"><div class="kv">' +
      kvp("Driver", c.driverName) + kvp("Employee ID", c.employeeId) + kvp("Department", c.department) + kvp("Vehicle number", c.vehicle) +
      kvp("Period", fmtDate(c.periodFrom) + " – " + fmtDate(c.periodTo)) + kvp("Submission date", fmtDate(c.submissionDate)) +
      (eff ? kvp("Distance", eff.km.toLocaleString() + " km") + kvp("Fuel economy", eff.kmpl.toFixed(1) + " km/L") : "") +
      (c.amountApproved !== undefined && c.amountApproved !== null ? kvp("Amount approved", kd(c.amountApproved) + " KD") : "") + "</div></div>";

    h += '<div class="section-title"><h2>Fuel receipts</h2></div>' + receiptsBlock(c, false) + '<div style="height:10px"></div>' + totalsBar(c);

    if (c.driverSignature || c.approverSignature) {
      h += '<div class="section-title"><h2>Signatures</h2></div><div class="card"><div class="grid2">' +
        (c.driverSignature ? '<div><div class="eyebrow">Driver</div><img class="sig-img" alt="Driver signature" src="' + esc(c.driverSignature) + '"></div>' : "<div></div>") +
        (c.approverSignature ? '<div><div class="eyebrow">Approved by ' + esc(c.approvedBy || "") + '</div><img class="sig-img" alt="Approver signature" src="' + esc(c.approverSignature) + '"></div>' : "") + "</div></div>";
    }

    var hist = (c.history || []).slice().reverse();
    if (hist.length) {
      h += '<div class="section-title"><h2>History</h2></div><div class="card"><ul class="timeline">' + hist.map(function (x) {
        return "<li><b>" + esc((S.STATUS[x.status] || {}).label || x.status) + "</b><span>" + esc(x.byName) + " · " + esc(fmtTime(x.at)) + "</span>" + (x.note ? "<p>" + esc(x.note) + "</p>" : "") + "</li>";
      }).join("") + "</ul></div>";
    }
    if (c.ownerUid === u.uid && c.status === "draft") {
      h += '<div style="margin-top:18px"><button class="btn bad block" data-act="delete-claim" data-id="' + esc(c.id) + '">Delete draft</button></div>';
    }
    return h;
  }

  function viewClaimLocal(id) {
    var c = findClaim(id);
    if (!c) return '<div class="card empty"><b>Claim not found</b>It may have been deleted. <a href="#/home">Go home</a></div>';
    var admin = isOffice() && c.ownerUid !== st.user.uid, own = c.ownerUid === st.user.uid || LOCAL, acts0 = claimActions(c);
    var h = '<div class="spread" style="margin-bottom:4px"><h1>' + esc(c.claimNo || "Claim") + "</h1>" + statusChip(c.status) + "</div>" +
      '<p class="sub">' + (admin ? esc(c.driverName) + " · " : "") + esc(fmtDate(c.periodFrom)) + " – " + esc(fmtDate(c.periodTo)) + " · " + esc(c.vehicle || "") + "</p>";

    // status message
    var msg = "";
    if (st.justFinished === c.id && c.status === "submitted") msg = '<div class="banner good"><b>Claim created ✓</b> ' + (LOCAL ? "Now send the PDF to the office on WhatsApp." : "The admin can see it now and will check it.") + "</div>";
    else if (c.status === "submitted") msg = '<div class="banner info">' + (admin ? (canApprove() ? "Check the bills and photos, then verify or approve, return or reject this claim." : "Check the bills and photos, then verify it for the manager, or return it to the driver.") : LOCAL ? "Send the PDF to the office. When the money arrives, tap <b>Mark as paid</b>." : "Waiting for the admin to check and approve it.") + "</div>";
    else if (c.status === "verified") msg = '<div class="banner info"><b>Verified</b> by ' + esc(c.verifiedBy || "") + " on " + esc(fmtTime(c.verifiedAt)) + (admin && canApprove() ? ". Approve it, return it or reject it." : ". Waiting for the manager to approve it.") + (c.remarks ? "<br>" + esc(c.remarks) : "") + "</div>";
    else if (c.status === "approved") msg = '<div class="banner good"><b>Approved ' + kd(c.amountApproved) + " KD</b> by " + esc(c.approvedBy || "") + " on " + esc(fmtTime(c.approvedAt)) + (admin ? ". Mark it paid when the money is sent." : ". Waiting for payment.") + (c.remarks ? "<br>" + esc(c.remarks) : "") + "</div>";
    else if (c.status === "paid") msg = '<div class="banner good"><b>Paid ' + kd(paidAmt(c)) + " KD</b> on " + esc(fmtDate(new Date(c.paidAt).toISOString())) + (c.paidRef ? " · Ref. " + esc(c.paidRef) : "") + "</div>";
    else if (c.status === "returned") msg = '<div class="banner warn"><b>Returned by the admin:</b> ' + esc(c.remarks || "") + (own && !admin ? "<br>Delete this claim to fix the bills, then create it again." : "") + "</div>";
    else if (c.status === "rejected") msg = '<div class="banner bad"><b>Rejected:</b> ' + esc(c.remarks || "") + "</div>";
    if (msg) h += msg.replace('class="banner', 'style="margin-bottom:14px" class="banner');

    var acts = [];
    if (acts0.indexOf("verify") >= 0 && !canApprove()) acts.push('<button class="btn good" data-act="do" data-a="verify" data-id="' + esc(c.id) + '">Verify</button>');
    if (acts0.indexOf("approve") >= 0) acts.push('<button class="btn good" data-act="approve" data-id="' + esc(c.id) + '">Approve</button>');
    if (acts0.indexOf("verify") >= 0 && canApprove()) acts.push('<button class="btn" data-act="do" data-a="verify" data-id="' + esc(c.id) + '">Verify only</button>');
    if (acts0.indexOf("return") >= 0) acts.push('<button class="btn warn" data-act="do" data-a="return" data-id="' + esc(c.id) + '">Return to driver</button>');
    if (acts0.indexOf("reject") >= 0) acts.push('<button class="btn bad" data-act="do" data-a="reject" data-id="' + esc(c.id) + '">Reject</button>');
    if (acts0.indexOf("pay") >= 0 || (LOCAL && c.status === "submitted")) acts.push('<button class="btn good" data-act="mark-paid" data-id="' + esc(c.id) + '">Mark as paid</button>');
    if (acts0.indexOf("reopen") >= 0 || (LOCAL && c.status === "paid")) acts.push('<button class="btn" data-act="reopen" data-id="' + esc(c.id) + '">Not paid yet</button>');
    if (isOffice() && c.ownerUid === st.user.uid && c.status !== "paid") h += '<p class="sub" style="font-size:12.5px">This is your own claim, so someone else must verify and approve it.</p>';
    acts.push('<button class="btn' + (acts.length ? "" : " primary") + '" data-act="share" data-id="' + esc(c.id) + '">' + (canShare() ? ICON.whatsapp + "Share on WhatsApp" : ICON.share + "Share PDF") + "</button>");
    acts.push('<button class="btn" data-act="pdf" data-id="' + esc(c.id) + '">' + ICON.pdf + "Download PDF</button>");
    h += '<div class="btn-row" style="margin-bottom:6px">' + acts.join("") + "</div>";

    h += '<div class="section-title"><h2>Details</h2></div><div class="card"><div class="kv">' +
      kvp("Driver", c.driverName) + kvp("Employee ID", c.employeeId) + kvp("Department", c.department) + kvp("Vehicle number", c.vehicle) +
      kvp("Period", fmtDate(c.periodFrom) + " – " + fmtDate(c.periodTo)) + kvp("Submission date", fmtDate(c.submissionDate)) +
      kvp("Amount claimed", kd(c.totals ? c.totals.amount : 0) + " KD") +
      (c.amountApproved !== undefined && c.amountApproved !== null && c.approvedAt ? kvp("Amount approved", kd(c.amountApproved) + " KD") : "") +
      (c.status === "paid" ? kvp("Amount paid", kd(paidAmt(c)) + " KD") : "") + "</div></div>";
    var cm = claimMileage(c);
    if (cm) h += '<div class="section-title"><h2>Mileage</h2></div>' + mileageCard(cm).replace('style="margin-top:10px"', "");
    h += '<div class="section-title"><h2>Fuel bills</h2></div>' + receiptsBlock(c, false) + '<div style="height:10px"></div>' + totalsBar(c);
    if (c.driverSignature || c.approverSignature) {
      h += '<div class="section-title"><h2>Signatures</h2></div><div class="card"><div class="grid2">' +
        (c.driverSignature ? '<div><div class="eyebrow">Driver</div><img class="sig-img" alt="Driver signature" src="' + esc(c.driverSignature) + '"></div>' : "<div></div>") +
        (c.approverSignature ? '<div><div class="eyebrow">Approved by ' + esc(c.approvedBy || "") + '</div><img class="sig-img" alt="Admin signature" src="' + esc(c.approverSignature) + '"></div>' : "") + "</div></div>";
    }
    var hist = (c.history || []).slice().reverse();
    if (hist.length && !LOCAL) {
      h += '<div class="section-title"><h2>History</h2></div><div class="card"><ul class="timeline">' + hist.map(function (x) {
        return "<li><b>" + esc((S.STATUS[x.status] || {}).label || x.status) + "</b><span>" + esc(x.byName) + " · " + esc(fmtTime(x.at)) + "</span>" + (x.note ? "<p>" + esc(x.note) + "</p>" : "") + "</li>";
      }).join("") + "</ul></div>";
    }
    var canDelete = LOCAL ? c.status !== "paid" : isAdmin() || (own && (c.status === "submitted" || c.status === "returned"));
    if (canDelete) {
      h += '<div style="margin-top:22px"><button class="btn bad block" data-act="delete-claim" data-id="' + esc(c.id) + '">Delete claim</button><p class="sub" style="font-size:12.5px;margin-top:6px">Deleting the claim puts its bills back in the list.</p></div>';
    }
    return h;
  }

  /** Admin approval: amount, remarks and the admin's signature (saved once, like the driver's). */
  function approveSheet(id) {
    var c = findClaim(id), u = st.user;
    if (!c) return;
    var h = '<h2>Approve claim</h2><p class="sub" style="margin-top:-6px">' + esc(c.claimNo) + " · " + esc(c.driverName) + " · " + kd(c.totals.amount) + ' KD claimed</p><div class="stack">' +
      '<div class="banner info">Check that every bill photo matches its date, litres and amount before approving.</div>' +
      '<div class="field"><label for="a-amount">Amount approved (KD)</label><input id="a-amount" type="number" step="0.001" min="0" inputmode="decimal" value="' + kd(c.totals.amount) + '"><span class="hint">Lower it if part of the claim isn\'t accepted, and say why in the remarks.</span></div>' +
      '<div class="field"><label for="a-note">Remarks (optional)</label><textarea id="a-note"></textarea></div>' +
      '<div class="field"><label>Signature / stamp</label>' + (u.signature ? '<img class="sig-img" alt="Your saved signature" src="' + esc(u.signature) + '"><span class="hint">Your saved signature goes on the form. Change it in Profile.</span>'
        : '<div class="sig" id="a-sig"><canvas></canvas><div class="base"></div><div class="ph">Sign here</div></div><span class="hint">Saved for the next approvals.</span>') + "</div>" +
      '<div class="btn-row"><button class="btn" data-close>Cancel</button><button class="btn good" id="a-go">Approve</button></div></div>';
    sheet(h, function (el, close) {
      var pad = u.signature ? null : signaturePad(el.querySelector("#a-sig"));
      el.querySelector("#a-go").onclick = function () {
        var amt = parseFloat(el.querySelector("#a-amount").value);
        if (isNaN(amt) || amt < 0) { toast("Enter the amount approved."); return; }
        var sig = u.signature || (pad && !pad.isEmpty() ? pad.toDataURL() : "");
        if (!sig) { toast("Please sign to approve."); return; }
        this.disabled = true;
        (u.signature ? Promise.resolve() : S.updateProfile({ signature: sig })).then(function () {
          return S.act(c, "approve", { amountApproved: Math.round(amt * 1000) / 1000, signature: sig, note: el.querySelector("#a-note").value.trim() });
        }).then(function () { close(); toast("Claim approved"); }).catch(function (e) { toast(e.message); });
      };
    });
  }

  function markPaid(id) {
    var c = findClaim(id);
    if (!c) return;
    var h = '<h2>Mark as paid</h2><p class="sub" style="margin-top:-6px">' + esc(c.claimNo) + " · " + kd(c.totals.amount) + ' KD claimed</p><div class="stack">' +
      '<div class="grid2"><div class="field"><label for="p-amount">Amount received (KD)</label><input id="p-amount" type="number" step="0.001" min="0" inputmode="decimal" value="' + kd(c.approvedAt ? c.amountApproved : c.totals.amount) + '"></div>' +
      '<div class="field"><label for="p-date">Date paid</label><input id="p-date" type="date" value="' + today() + '" max="' + today() + '"></div></div>' +
      '<div class="field"><label for="p-ref">Reference (optional)</label><input id="p-ref" placeholder="e.g. salary, cash voucher number"></div>' +
      '<div class="btn-row"><button class="btn" data-close>Cancel</button><button class="btn good" id="p-go">Mark as paid</button></div></div>';
    sheet(h, function (el, close) {
      el.querySelector("#p-go").onclick = function () {
        var amt = parseFloat(el.querySelector("#p-amount").value), d = el.querySelector("#p-date").value || today();
        if (isNaN(amt) || amt < 0) { toast("Enter the amount you received."); return; }
        S.act(c, "markPaid", { amount: Math.round(amt * 1000) / 1000, paidAt: new Date(d + "T12:00:00").getTime(), reference: el.querySelector("#p-ref").value.trim() })
          .then(function () { close(); toast("Marked as paid"); })
          .catch(function (e) { toast(e.message); });
      };
    });
  }

  function viewSetup() {
    return '<div class="login"><div class="box"><div class="brand"><img src="img/logo.png" alt="EZ Storage">' +
      '<h1>Fuel Expense Claims</h1><p class="sub" style="margin:4px 0 0">Add your fuel receipts, sign, and send the claim PDF to the office on WhatsApp.</p></div>' +
      '<form id="setup-form" class="card stack" novalidate><div class="eyebrow">Your details (once)</div>' +
      field("name", "Full name", "text", "", 'autocomplete="name" required') +
      '<div class="grid2">' + field("employeeId", "Employee ID", "text", "", "required") + selectField("department", "Department", C.departments, "") + "</div>" +
      field("vehicle", "Vehicle number", "text", "", 'placeholder="e.g. KWT 12-34567" required') +
      '<div id="setup-msg" class="banner bad" hidden></div>' +
      '<button class="btn primary block" type="submit">Start</button>' +
      '<p class="sub" style="margin:0;font-size:12.5px">These go on every claim form. You can change them later in Profile. Your claims are saved on this phone only.</p></form></div></div>';
  }

  function kvp(k, v) {
    return "<div><span>" + esc(k) + "</span><b>" + esc(v || "—") + "</b></div>";
  }

  function loadThumbs() {
    document.querySelectorAll("[data-thumb]").forEach(function (b) {
      var pid = b.getAttribute("data-thumb");
      if (!pid) return;
      getPhoto(b.getAttribute("data-claim"), pid).then(function (d) {
        if (!d) return;
        b.innerHTML = "";
        b.style.backgroundImage = "url('" + d.replace(/'/g, "%27") + "')";
        b.style.backgroundSize = "cover";
        b.style.backgroundPosition = "center";
      });
    });
  }

  // ------------------------------------------------------------------ actions on a claim

  function doAction(id, action) {
    var c = findClaim(id);
    if (!c) return;
    var labels = { verify: "Verify claim", approve: "Approve claim", pay: "Mark as paid", "return": "Return to driver", reject: "Reject claim" };
    var h = "<h2>" + labels[action] + "</h2><p class=\"sub\" style=\"margin-top:-6px\">" + esc(c.claimNo) + " · " + esc(c.driverName) + " · " + kd(c.totals.amount) + " KD submitted</p><div class=\"stack\">";
    if (action === "verify") {
      h += '<div class="banner info">Check that every receipt photo matches the amounts, dates and vehicle before verifying.</div>' +
        '<div class="field"><label for="a-note">Note (optional)</label><textarea id="a-note" placeholder="Anything the approver should know"></textarea></div>';
    } else if (action === "approve") {
      h += '<div class="field"><label for="a-amount">Amount approved (KD)</label><input id="a-amount" type="number" step="0.001" min="0" inputmode="decimal" value="' + kd(c.totals.amount) + '"><span class="hint">Change it if part of the claim isn\'t accepted, and explain in the remarks.</span></div>' +
        '<div class="field"><label for="a-note">Remarks (optional)</label><textarea id="a-note"></textarea></div>' +
        '<div class="field"><label>Signature / stamp</label><div class="sig" id="a-sig"><canvas></canvas><div class="base"></div><div class="ph">Sign here with your finger</div></div><button type="button" class="link" data-sig-clear>Clear signature</button></div>';
    } else if (action === "pay") {
      h += '<div class="field"><label for="a-ref">Payment reference</label><input id="a-ref" placeholder="e.g. bank transfer or cash voucher number"></div>' +
        '<div class="field"><label for="a-note">Note (optional)</label><textarea id="a-note"></textarea></div>';
    } else {
      h += '<div class="field"><label for="a-note">' + (action === "return" ? "What should the driver fix?" : "Reason for rejecting") + '</label><textarea id="a-note" required></textarea><span class="msg" id="a-err" hidden>Please write a short reason.</span></div>';
    }
    h += '<div class="btn-row"><button class="btn" data-close>Cancel</button><button class="btn ' + (action === "reject" ? "bad" : action === "return" ? "warn" : "good") + '" id="a-go">' + labels[action] + "</button></div></div>";
    sheet(h, function (el, close) {
      var pad = action === "approve" ? signaturePad(el.querySelector("#a-sig")) : null;
      var clr = el.querySelector("[data-sig-clear]");
      if (clr) clr.onclick = function () { pad.clear(); };
      el.querySelector("#a-go").onclick = function () {
        var note = (el.querySelector("#a-note") || {}).value || "";
        var data = { note: note.trim() };
        if ((action === "return" || action === "reject") && !data.note) {
          el.querySelector("#a-err").hidden = false;
          return;
        }
        if (action === "approve") {
          var amt = parseFloat(el.querySelector("#a-amount").value);
          if (isNaN(amt) || amt < 0) {
            toast("Enter the amount approved.");
            return;
          }
          if (pad.isEmpty()) {
            toast("Please sign to approve.");
            return;
          }
          data.amountApproved = Math.round(amt * 1000) / 1000;
          data.signature = pad.toDataURL();
        }
        if (action === "pay") data.reference = el.querySelector("#a-ref").value.trim();
        this.disabled = true;
        S.act(c, action, data).then(function () {
          close();
          toast({ verify: "Claim verified", approve: "Claim approved", pay: "Marked as paid", "return": "Returned to driver", reject: "Claim rejected" }[action]);
        }).catch(function (e) {
          toast(e.message);
        });
      };
    });
  }

  // ------------------------------------------------------------------ claim form (3 steps)

  function startDraft(id) {
    if (id) {
      var c = findClaim(id);
      if (!c) return false;
      st.draft = JSON.parse(JSON.stringify(c));
    } else {
      var u = st.user, d = new Date();
      var first = new Date(d.getFullYear(), d.getMonth(), 1);
      st.draft = {
        ownerUid: u.uid, driverName: u.name, employeeId: u.employeeId || "", department: u.department || "", vehicle: u.vehicle || "",
        periodFrom: new Date(first.getTime() - first.getTimezoneOffset() * 60000).toISOString().slice(0, 10), periodTo: today(),
        submissionDate: today(), receipts: [], declaration: false, driverSignature: "", status: "draft", history: []
      };
    }
    st.step = 1;
    return true;
  }

  function viewForm() {
    var d = st.draft;
    if (!d) return "";
    var steps = ["Details", "Receipts", "Review & sign"];
    var h = '<div class="spread"><h1>' + (d.id ? esc(d.claimNo || "Draft claim") : "New fuel claim") + '</h1><button class="link" data-act="save-draft">Save draft</button></div>' +
      '<div class="steps">' + steps.map(function (s, i) { return '<div class="' + (st.step === i + 1 ? "on" : st.step > i + 1 ? "done" : "") + '">' + (i + 1) + ". " + s + "</div>"; }).join("") + "</div>";
    if (d.status === "returned" && d.remarks) h += '<div class="banner warn" style="margin-bottom:14px"><b>Office note:</b> ' + esc(d.remarks) + "</div>";

    if (st.step === 1) {
      h += '<div class="card stack"><div class="eyebrow">A. Driver & submission details</div>' +
        '<div class="grid2">' + field("driverName", "Driver name", "text", d.driverName, 'data-draft="driverName" required') + field("employeeId", "Employee ID", "text", d.employeeId, 'data-draft="employeeId" required') + "</div>" +
        '<div class="grid2">' + field("vehicle", "Vehicle number", "text", d.vehicle, 'data-draft="vehicle" required placeholder="e.g. KWT 12-34567"') +
        selectField("department", "Department", C.departments, d.department).replace("<select ", '<select data-draft="department" ') + "</div>" +
        '<div class="grid2">' + field("periodFrom", "Period from", "date", d.periodFrom, 'data-draft="periodFrom" required') + field("periodTo", "Period to", "date", d.periodTo, 'data-draft="periodTo" required') + "</div>" +
        '<p class="sub" style="margin:0;font-size:13px">These come from your profile. Change them here if this claim is for a different vehicle.</p></div>' +
        '<div class="sticky-actions"><a class="btn" href="#/home">Cancel</a><button class="btn primary" data-act="step" data-to="2">Next: receipts</button></div>';
    } else if (st.step === 2) {
      h += '<div class="spread" style="margin-bottom:10px"><div class="eyebrow">B. Fuel receipt details</div><button class="btn small primary" data-act="add-receipt">' + ICON.plus + "Add receipt</button></div>" +
        receiptsBlock(d, true) + '<div style="height:10px"></div>' + totalsBar(d) +
        '<p class="sub" style="font-size:13px;margin-top:10px">Add every fuel receipt for ' + esc(fmtDate(d.periodFrom)) + " – " + esc(fmtDate(d.periodTo)) + ", with a clear photo of each one.</p>" +
        '<div class="sticky-actions"><button class="btn" data-act="step" data-to="1">Back</button><button class="btn primary" data-act="step" data-to="3">Next: review</button></div>';
    } else {
      var t = S.totals(d.receipts);
      h += '<div class="card stack"><div class="eyebrow">C. Submission summary</div><div class="kv">' +
        kvp("Driver", d.driverName) + kvp("Vehicle", d.vehicle) + kvp("Period", fmtDate(d.periodFrom) + " – " + fmtDate(d.periodTo)) +
        kvp("Number of receipts", String(t.count)) + kvp("Total litres", lit(t.litres)) + kvp("Total amount", kd(t.amount) + " KD") + "</div></div>" +
        '<div class="card stack" style="margin-top:14px"><div class="eyebrow">D. Driver declaration</div>' +
        '<label class="check"><input type="checkbox" id="decl" ' + (d.declaration ? "checked" : "") + '><span>I confirm that all fuel receipts listed above relate to the company vehicle and that the information provided is correct. All original receipts are attached.</span></label>' +
        '<div class="field"><label>Driver signature</label>' + (d.driverSignature ? '<img class="sig-img" alt="Your signature" src="' + esc(d.driverSignature) + '"><button type="button" class="link" data-act="resign">Sign again</button>' :
          '<div class="sig" id="d-sig"><canvas></canvas><div class="base"></div><div class="ph">Sign here with your finger</div></div><button type="button" class="link" data-act="sig-clear">Clear signature</button>') + "</div></div>" +
        '<div id="submit-msg" class="banner bad" style="margin-top:14px" hidden></div>' +
        '<div class="sticky-actions"><button class="btn" data-act="step" data-to="2">Back</button><button class="btn primary" data-act="submit-claim">' + (LOCAL ? (d.status === "submitted" ? "Save changes" : "Finish claim") : "Submit claim") + "</button></div>";
    }
    return h;
  }

  var draftPad = null;

  function readStep1() {
    document.querySelectorAll("[data-draft]").forEach(function (el) { st.draft[el.getAttribute("data-draft")] = el.value.trim(); });
  }

  function checkStep1() {
    var d = st.draft, bad = [];
    ["driverName", "employeeId", "vehicle", "department", "periodFrom", "periodTo"].forEach(function (k) { if (!d[k]) bad.push(k); });
    if (d.periodFrom && d.periodTo && d.periodFrom > d.periodTo) bad.push("periodTo");
    document.querySelectorAll(".field").forEach(function (f) {
      f.classList.toggle("err", bad.indexOf(f.getAttribute("data-f")) >= 0);
    });
    if (bad.length) toast(bad.indexOf("periodTo") >= 0 && d.periodTo ? "\"Period to\" must be after \"Period from\"." : "Please fill in the highlighted fields.");
    return !bad.length;
  }

  function persistDraft(quiet) {
    var d = st.draft;
    var p = d.claimNo ? Promise.resolve(d.claimNo) : S.newClaimNo();
    return p.then(function (no) {
      d.claimNo = no;
      return S.saveClaim(d);
    }).then(function (saved) {
      st.draft.id = saved.id;
      if (!quiet) toast("Draft saved");
      return saved;
    });
  }

  function receiptSheet(index) {
    var d = st.draft;
    var r = index >= 0 ? JSON.parse(JSON.stringify(d.receipts[index])) : { date: today(), station: "", odometer: "", litres: "", amount: "", photoId: "" };
    var stations = {};
    st.mine.concat([d]).forEach(function (c) { (c.receipts || []).forEach(function (x) { if (x.station) stations[x.station] = 1; }); });
    var newPhoto = null;
    var h = "<h2>" + (index >= 0 ? "Receipt " + (index + 1) : "Add receipt") + "</h2><div class=\"stack\">" +
      '<div class="photo-pick"><span id="r-prev">' + (r.photoId ? '<img alt="Receipt photo" id="r-img">' : '<span class="ph">' + ICON.camera + "</span>") + '</span><div class="grow"><b>Receipt photo</b><div class="hint" style="font-size:12.5px;color:var(--muted)">Lay the receipt flat in good light.</div>' +
      '<div class="row" style="margin-top:8px"><label class="btn small primary">' + ICON.camera + 'Take photo<input type="file" accept="image/*" capture="environment" id="r-cam" hidden></label><label class="btn small">Choose<input type="file" accept="image/*" id="r-file" hidden></label></div></div></div>' +
      '<div class="grid2">' + field("r-date", "Fuel date", "date", r.date, 'max="' + today() + '"') + field("r-odo", "Odometer (km)", "number", r.odometer, 'inputmode="numeric" min="0" step="1"') + "</div>" +
      '<div class="field" data-f="r-station"><label for="f-r-station">Fuel station</label><input id="f-r-station" list="stations" value="' + esc(r.station) + '" placeholder="e.g. KNPC Salmiya"><datalist id="stations">' +
      Object.keys(stations).map(function (s) { return '<option value="' + esc(s) + '">'; }).join("") + "</datalist></div>" +
      '<div class="grid2">' + field("r-litres", "Litres", "number", r.litres, 'inputmode="decimal" min="0" step="0.01"') + field("r-amount", "Amount (KD)", "number", r.amount, 'inputmode="decimal" min="0" step="0.001"') + "</div>" +
      '<div class="hint" id="r-ppl" style="font-size:13px;color:var(--muted)"></div><div id="r-msg" class="banner bad" hidden></div>' +
      '<div class="btn-row">' + (index >= 0 ? '<button class="btn bad" id="r-del">Remove</button>' : '<button class="btn" data-close>Cancel</button>') + '<button class="btn primary" id="r-save">Save receipt</button></div></div>';
    sheet(h, function (el, close) {
      if (r.photoId) getPhoto(d.id, r.photoId).then(function (src) { var i = el.querySelector("#r-img"); if (i && src) i.src = src; });
      function ppl() {
        var l = parseFloat(el.querySelector("#f-r-litres").value), a = parseFloat(el.querySelector("#f-r-amount").value);
        el.querySelector("#r-ppl").textContent = l > 0 && a > 0 ? "Price: " + (a / l).toFixed(3) + " KD per litre" : "";
      }
      el.addEventListener("input", ppl);
      ppl();
      function onFile(e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        compressImage(f).then(function (data) {
          newPhoto = data;
          el.querySelector("#r-prev").innerHTML = '<img alt="Receipt photo" src="' + data + '">';
        }).catch(function (err) { toast(err.message); });
      }
      el.querySelector("#r-cam").onchange = onFile;
      el.querySelector("#r-file").onchange = onFile;
      var del = el.querySelector("#r-del");
      if (del) del.onclick = function () {
        d.receipts.splice(index, 1);
        close();
        persistDraft(true).then(route);
      };
      el.querySelector("#r-save").onclick = function () {
        var btn = this;
        r.date = el.querySelector("#f-r-date").value;
        r.station = el.querySelector("#f-r-station").value.trim();
        r.odometer = el.querySelector("#f-r-odo").value ? Math.round(Number(el.querySelector("#f-r-odo").value)) : "";
        r.litres = el.querySelector("#f-r-litres").value ? Math.round(Number(el.querySelector("#f-r-litres").value) * 100) / 100 : "";
        r.amount = el.querySelector("#f-r-amount").value ? Math.round(Number(el.querySelector("#f-r-amount").value) * 1000) / 1000 : "";
        var miss = [];
        if (!r.date) miss.push("fuel date");
        if (!r.station) miss.push("fuel station");
        if (!(r.litres > 0)) miss.push("litres");
        if (!(r.amount > 0)) miss.push("amount");
        if (!newPhoto && !r.photoId) miss.push("receipt photo");
        if (miss.length) {
          var m = el.querySelector("#r-msg");
          m.hidden = false;
          m.textContent = "Please add the " + miss.join(", ") + ".";
          return;
        }
        btn.disabled = true;
        btn.textContent = "Saving…";
        var ready = d.id ? Promise.resolve() : persistDraft(true);
        ready.then(function () {
          return newPhoto ? S.savePhoto(d.id, newPhoto).then(function (pid) { st.photoCache[pid] = newPhoto; r.photoId = pid; }) : null;
        }).then(function () {
          if (!r.id) r.id = "r" + Date.now().toString(36);
          if (index >= 0) d.receipts[index] = r;
          else d.receipts.push(r);
          d.receipts.sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
          return persistDraft(true);
        }).then(function () {
          close();
          toast("Receipt saved");
          route();
        }).catch(function (e) {
          btn.disabled = false;
          btn.textContent = "Save receipt";
          toast(e.message);
        });
      };
    });
  }

  function submitDraft() {
    var d = st.draft, msg = document.getElementById("submit-msg"), problems = [];
    d.declaration = document.getElementById("decl").checked;
    if (draftPad && !draftPad.isEmpty()) d.driverSignature = draftPad.toDataURL();
    if (!d.receipts.length) problems.push("Add at least one fuel receipt.");
    d.receipts.forEach(function (r, i) { if (!r.photoId) problems.push("Receipt " + (i + 1) + " has no photo."); });
    if (!d.declaration) problems.push("Tick the declaration to confirm.");
    if (!d.driverSignature) problems.push("Sign in the signature box.");
    if (problems.length) {
      msg.hidden = false;
      msg.innerHTML = problems.map(esc).join("<br>");
      return;
    }
    var btn = document.querySelector('[data-act="submit-claim"]');
    btn.disabled = true;
    btn.textContent = "Submitting…";
    var already = d.status === "submitted";
    if (!already) d.submissionDate = today();
    persistDraft(true).then(function (saved) {
      return already ? saved : S.act(saved, "submit", {});
    }).then(function (c) {
      st.draft = null;
      st.justFinished = LOCAL ? c.id : null;
      toast(LOCAL ? (already ? "Claim updated" : "Claim finished") : "Claim submitted for approval");
      go("#/claim/" + c.id);
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = LOCAL ? "Finish claim" : "Submit claim";
      toast(e.message);
    });
  }

  // ------------------------------------------------------------------ office dashboard

  function officeQueue() {
    var r = st.user.role;
    return {
      verify: st.all.filter(function (c) { return c.status === "submitted"; }),
      approve: st.all.filter(function (c) { return c.status === "verified"; }),
      pay: st.all.filter(function (c) { return c.status === "approved"; }),
      mine: st.all.filter(function (c) {
        return (c.status === "submitted" && (r === "verifier" || r === "admin")) ||
          (c.status === "verified" && (r === "approver" || r === "admin")) ||
          (c.status === "approved" && (r === "approver" || r === "admin"));
      })
    };
  }

  function filteredAll() {
    var f = st.filter, q = f.q.toLowerCase();
    return st.all.filter(function (c) {
      if (f.status !== "all" && c.status !== f.status) return false;
      if (f.month !== "all" && monthKey(c) !== f.month) return false;
      if (f.driver !== "all" && c.ownerUid !== f.driver) return false;
      if (q && (c.driverName + " " + c.claimNo + " " + c.vehicle + " " + c.employeeId).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function chart(claims) {
    var months = [], d = new Date();
    for (var i = 5; i >= 0; i--) {
      var m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push(m.getFullYear() + "-" + ("0" + (m.getMonth() + 1)).slice(-2));
    }
    var sub = {}, paid = {};
    claims.forEach(function (c) {
      var k = monthKey(c);
      sub[k] = (sub[k] || 0) + (c.totals ? c.totals.amount : 0);
      if (c.status === "approved" || c.status === "paid") paid[k] = (paid[k] || 0) + amountOf(c);
    });
    var max = Math.max.apply(null, months.map(function (k) { return sub[k] || 0; }).concat([1]));
    var nice = Math.pow(10, Math.floor(Math.log10(max)));
    max = Math.ceil(max / nice) * nice;
    var W = 600, H = 220, L = 46, B = 28, T = 12, cw = (W - L - 8) / 6;
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Fuel claims by month, last 6 months">';
    for (var g = 0; g <= 4; g++) {
      var y = T + (H - T - B) * g / 4, v = max * (1 - g / 4);
      s += '<line x1="' + L + '" x2="' + (W - 4) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/>' +
        '<text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="var(--muted)">' + (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + "</text>";
    }
    months.forEach(function (k, i) {
      var x = L + i * cw + cw * 0.18, bw = cw * 0.3;
      var h1 = (H - T - B) * (sub[k] || 0) / max, h2 = (H - T - B) * (paid[k] || 0) / max;
      s += '<rect x="' + x + '" y="' + (H - B - h1) + '" width="' + bw + '" height="' + h1 + '" rx="3" fill="var(--brand)"><title>' + monthLabel(k) + ": " + kd(sub[k] || 0) + " KD submitted</title></rect>";
      s += '<rect x="' + (x + bw + 3) + '" y="' + (H - B - h2) + '" width="' + bw + '" height="' + h2 + '" rx="3" fill="var(--good)"><title>' + monthLabel(k) + ": " + kd(paid[k] || 0) + " KD approved</title></rect>";
      s += '<text x="' + (L + i * cw + cw / 2) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="11.5" fill="var(--muted)">' + esc(monthLabel(k).split(" ")[0]) + "</text>";
    });
    return '<div class="chart">' + s + '</svg><div class="legend"><span><i style="background:var(--brand)"></i>Submitted (KD)</span><span><i style="background:var(--good)"></i>Approved & paid (KD)</span></div></div>';
  }

  function viewOffice() {
    if (!isStaff()) return '<div class="card empty"><b>Office only</b>This page is for verifiers, approvers and administrators.</div>';
    var q = officeQueue(), month = new Date().toISOString().slice(0, 7);
    var paidMonth = st.all.filter(function (c) { return c.status === "paid" && c.paidAt && new Date(c.paidAt).toISOString().slice(0, 7) === month; });
    var h = '<h1>Office dashboard</h1><p class="sub">All fuel claims from staff · ' + plural(st.all.length, "claim") + " in total</p>";
    if (st.allError) h += '<div class="banner bad" style="margin-bottom:14px">' + esc(st.allError) + "</div>";
    h += '<div class="kpis">' +
      kpi("To verify", q.verify.length, "", kd(sum(q.verify)) + " KD", true) +
      kpi("To approve", q.approve.length, "", kd(sum(q.approve)) + " KD", true) +
      kpi("Approved, unpaid", kd(sum(q.pay)), "KD", plural(q.pay.length, "claim")) +
      kpi("Paid this month", kd(sum(paidMonth)), "KD", plural(paidMonth.length, "claim")) + "</div>";

    var tabs = [["queue", "My queue (" + q.mine.length + ")"], ["all", "All claims"], ["drivers", "By driver"], ["trend", "Trend"]];
    h += '<div class="chips" style="margin:18px 0 12px">' + tabs.map(function (t) { return '<button class="chip' + (st.officeTab === t[0] ? " on" : "") + '" data-act="office-tab" data-v="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>";

    if (st.officeTab === "queue") {
      h += q.mine.length ? '<div class="card flush list">' + q.mine.map(function (c) { return claimItem(c, true); }).join("") + "</div>"
        : '<div class="card empty"><b>All caught up</b>No claims are waiting for you.</div>';
    } else if (st.officeTab === "all") {
      var months = {}, drivers = {};
      st.all.forEach(function (c) { months[monthKey(c)] = 1; drivers[c.ownerUid] = c.driverName; });
      var f = st.filter;
      h += '<div class="card stack" style="margin-bottom:12px"><div class="grid3">' +
        '<div class="field"><label for="of-status">Status</label><select id="of-status" data-filter="status"><option value="all">All</option>' +
        Object.keys(S.STATUS).filter(function (k) { return k !== "draft"; }).map(function (k) { return '<option value="' + k + '"' + (f.status === k ? " selected" : "") + ">" + S.STATUS[k].label + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label for="of-month">Month</label><select id="of-month" data-filter="month"><option value="all">All months</option>' +
        Object.keys(months).sort().reverse().map(function (k) { return '<option value="' + k + '"' + (f.month === k ? " selected" : "") + ">" + esc(monthLabel(k)) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label for="of-driver">Driver</label><select id="of-driver" data-filter="driver"><option value="all">All drivers</option>' +
        Object.keys(drivers).map(function (k) { return '<option value="' + esc(k) + '"' + (f.driver === k ? " selected" : "") + ">" + esc(drivers[k]) + "</option>"; }).join("") + "</select></div></div>" +
        '<div class="field"><label for="of-q">Search</label><input id="of-q" data-filter="q" type="search" placeholder="Name, claim number, vehicle…" value="' + esc(f.q) + '"></div></div>';
      var list = filteredAll();
      h += '<div class="spread" style="margin-bottom:8px"><span class="sub" style="margin:0">' + plural(list.length, "claim") + " · " + kd(sum(list, function (c) { return c.totals ? c.totals.amount : 0; })) + ' KD submitted</span><button class="btn small" data-act="csv">' + ICON.pdf + "Export Excel (CSV)</button></div>";
      h += list.length ? '<div class="card flush list">' + list.map(function (c) { return claimItem(c, true); }).join("") + "</div>" : '<div class="card empty"><b>No matching claims</b>Try other filters.</div>';
    } else if (st.officeTab === "drivers") {
      var by = {};
      st.all.forEach(function (c) {
        if (c.status === "rejected") return;
        var b = by[c.ownerUid] = by[c.ownerUid] || { name: c.driverName, vehicle: c.vehicle, claims: 0, litres: 0, amount: 0, paid: 0, receipts: [] };
        b.claims++;
        b.litres += c.totals ? c.totals.litres : 0;
        b.amount += c.totals ? c.totals.amount : 0;
        if (c.status === "paid") b.paid += amountOf(c);
        b.receipts = b.receipts.concat(c.receipts || []);
      });
      var rows = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.amount - a.amount; });
      h += '<div class="card flush table-wrap"><table><thead><tr><th>Driver</th><th>Vehicle</th><th class="r">Claims</th><th class="r">Litres</th><th class="r">Submitted KD</th><th class="r">Paid KD</th><th class="r">km/L</th></tr></thead><tbody>' +
        rows.map(function (b) {
          var e = efficiency(b.receipts);
          return "<tr><td>" + esc(b.name) + "</td><td>" + esc(b.vehicle) + '</td><td class="r">' + b.claims + '</td><td class="r">' + lit(b.litres) + '</td><td class="r">' + kd(b.amount) + '</td><td class="r">' + kd(b.paid) + '</td><td class="r">' + (e ? e.kmpl.toFixed(1) : "—") + "</td></tr>";
        }).join("") + "</tbody></table></div>" + (rows.length ? "" : '<div class="card empty"><b>No data yet</b></div>');
    } else {
      h += '<div class="card">' + chart(st.all.filter(function (c) { return c.status !== "rejected"; })) + "</div>";
    }
    return h;
  }

  function exportCsv() {
    var list = filteredAll();
    var head = ["Claim No", "Driver", "Employee ID", "Vehicle", "Department", "Period From", "Period To", "Submission Date", "Receipts", "Litres", "Amount KD", "Approved KD", "Status", "Verified By", "Approved By", "Paid On", "Payment Ref", "Remarks"];
    var rows = list.map(function (c) {
      return [c.claimNo, c.driverName, c.employeeId, c.vehicle, c.department, c.periodFrom, c.periodTo, c.submissionDate,
        c.totals.count, lit(c.totals.litres), kd(c.totals.amount), c.amountApproved !== undefined && c.amountApproved !== null ? kd(c.amountApproved) : "",
        (S.STATUS[c.status] || {}).label, c.verifiedBy || "", c.approvedBy || "", c.paidAt ? new Date(c.paidAt).toISOString().slice(0, 10) : "", c.paidRef || "", c.remarks || ""];
    });
    var csv = [head].concat(rows).map(function (r) {
      return r.map(function (v) {
        v = String(v === undefined || v === null ? "" : v);
        if (/^[=+\-@]/.test(v)) v = "'" + v;
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(",");
    }).join("\r\n");
    saveFile(new Blob(["﻿" + csv], { type: "text/csv" }), "Fuel claims " + today() + ".csv");
  }

  // ------------------------------------------------------------------ staff (admin)

  function viewUsers() {
    if (!isAdmin()) return '<div class="card empty"><b>Admin only</b></div>';
    var order = function (u) { return u.pending && u.active === false ? 0 : u.active === false ? 2 : 1; };
    var users = st.users.slice().sort(function (a, b) { return order(a) - order(b) || (a.name || "").localeCompare(b.name || ""); });
    var h = '<div class="spread"><h1>People</h1><a class="btn small" href="#/settings">Company settings</a></div><p class="sub">Everyone who has created an account. New accounts can\'t use the app until you allow them. Choose each person\'s role and shift here.</p><div class="card flush list">';
    h += users.map(function (u) {
      var me = u.uid === st.user.uid, state = u.pending && u.active === false ? '<span class="status warn">Waiting to be allowed</span>'
        : u.active === false ? '<span class="status bad">Turned off</span>' : '<span class="status good">Allowed</span>';
      var pick = me ? "" : '<select aria-label="Role for ' + esc(u.name) + '" data-role="' + esc(u.uid) + '">' + S.ROLES.map(function (r) {
        return '<option value="' + r + '"' + ((u.role || "driver") === r ? " selected" : "") + ">" + esc(S.ROLE_LABELS[r]) + "</option>";
      }).join("") + "</select>";
      var btn = me ? "" : u.pending && u.active === false ? '<button class="btn small good" data-act="allow-user" data-uid="' + esc(u.uid) + '">Allow</button>'
        : '<button class="link" data-act="toggle-active" data-uid="' + esc(u.uid) + '">' + (u.active === false ? "Turn on" : "Turn off") + "</button>";
      var shiftPick = '<select aria-label="Shift for ' + esc(u.name) + '" data-shift="' + esc(u.uid) + '">' + tcfg().shifts.map(function (sh) {
        return '<option value="' + esc(sh.id) + '"' + (shiftOf(u).id === sh.id ? " selected" : "") + ">" + esc(shiftLabel(sh)) + "</option>";
      }).join("") + "</select>";
      btn = pick + shiftPick + btn;
      return '<div class="item"><span class="avatar">' + esc(initials(u.name)) + '</span><div class="main"><b>' + esc(u.name) + (me ? " (you)" : "") + "</b><span>" + esc(u.email || "") +
        " · " + esc(u.employeeId || "no ID") + " · " + esc(u.vehicle || "no vehicle") + '</span></div><div class="side">' + state + btn + "</div></div>";
    }).join("");
    return h + "</div>" + '<div class="card" style="margin-top:14px;font-size:13.5px"><b>Roles</b><br>' +
      "<b>Driver / Staff:</b> adds their own fuel bills and claims.<br>" +
      "<b>Supervisor:</b> also sees everyone's bills and claims, and verifies claims.<br>" +
      "<b>Manager:</b> also approves claims and marks them paid.<br>" +
      "<b>Admin:</b> everything, plus allowing people and choosing roles.<br>" +
      '<span class="sub" style="font-size:12.5px">Nobody can verify or approve their own claim.</span></div>';
  }

  // ------------------------------------------------------------------ profile

  function viewProfile() {
    var u = st.user;
    var h = '<h1>Profile</h1><p class="sub">' + (LOCAL ? "These details go on every claim form." : esc(u.email || "") + " · " + esc(S.ROLE_LABELS[u.role] || u.role)) + "</p>" +
      '<form id="profile-form" class="card stack">' + field("name", "Full name", "text", u.name, "required") +
      '<div class="grid2">' + field("employeeId", "Employee ID", "text", u.employeeId || "", "") + selectField("department", "Department", C.departments, u.department || "") + "</div>" +
      field("vehicle", "Vehicle number", "text", u.vehicle || "", 'placeholder="e.g. KWT 12-34567"') +
      '<button class="btn primary" type="submit">Save profile</button></form>' +
      (true ? '<div class="section-title"><h2>Signature</h2></div><div class="card spread">' +
        (u.signature ? '<img class="sig-img" alt="Your saved signature" src="' + esc(u.signature) + '">' : '<span class="sub" style="margin:0">Not set yet. You sign once, on your first claim.</span>') +
        '<button class="btn small" data-act="change-sig">' + (u.signature ? "Change" : "Add signature") + "</button></div>" : "") +
      '<div class="section-title"><h2>Install on your phone</h2></div><div class="card stack" style="font-size:14px">' +
      "<div><b>iPhone:</b> open this page in Safari → tap Share → <b>Add to Home Screen</b>.</div>" +
      "<div><b>Android:</b> install the EZ Fuel app, or in Chrome tap ⋮ → <b>Add to Home screen</b>.</div></div>" +
      '<div class="section-title"><h2>Appearance</h2></div><div class="chips">' +
      ["system", "light", "dark"].map(function (t) { return '<button class="chip' + ((localStorage.getItem("ezfuel-theme") || "system") === t ? " on" : "") + '" data-act="theme" data-v="' + t + '">' + t[0].toUpperCase() + t.slice(1) + "</button>"; }).join("") + "</div>" +
      (LOCAL ? '<div class="banner info" style="margin-top:24px">Your claims and receipt photos are saved on this phone only. Uninstalling the app or clearing its data deletes them, so keep the PDFs you send on WhatsApp.</div>'
        : '<div style="margin-top:24px" class="stack"><button class="btn block" data-act="signout">Sign out</button></div>') +
      '<p class="sub" style="text-align:center;margin-top:20px;font-size:12px">Form ' + esc(C.docNo) + " · Version " + esc(C.docVersion) + "</p>";
    return h;
  }

  function applyTheme() {
    var t = localStorage.getItem("ezfuel-theme") || "system";
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  // ------------------------------------------------------------------ fuel bills (on the phone)

  var CLAIM_SIZE = C.billsPerClaim || 10;

  function monthOf(iso) { return String(iso || "").slice(0, 7); }

  function billOrder(a, b) {
    return (a.date || "").localeCompare(b.date || "") || (Number(a.odometer) || 0) - (Number(b.odometer) || 0) || (a.createdAt || 0) - (b.createdAt || 0);
  }

  /** All bills, oldest first, with km since the previous fill-up, km per litre and price per litre. */
  function billsWithMileage(source) {
    var prev = null;
    return (source || st.bills).slice().sort(billOrder).map(function (b) {
      var x = {};
      for (var k in b) x[k] = b[k];
      var odo = Number(b.odometer), litres = Number(b.litres), amount = Number(b.amount);
      x.distance = prev && odo > Number(prev.odometer) ? odo - Number(prev.odometer) : null;
      x.kmpl = x.distance && litres > 0 ? x.distance / litres : null;
      x.ppl = litres > 0 && amount > 0 ? amount / litres : null;
      prev = b;
      return x;
    });
  }

  /** Distance, average km per litre and price per litre for a set of bills (from the odometer readings). */
  function mileageOf(list) {
    if (!list.length) return null;
    var withKm = list.filter(function (b) { return b.distance; });
    var km = sum(withKm, function (b) { return b.distance; });
    var kmLitres = sum(withKm, function (b) { return Number(b.litres) || 0; });
    var litres = sum(list, function (b) { return Number(b.litres) || 0; }), amount = sum(list, function (b) { return Number(b.amount) || 0; });
    var first = list[0], last = list[list.length - 1];
    return {
      km: km,
      kmpl: kmLitres > 0 && km > 0 ? Math.round(km / kmLitres * 10) / 10 : null,
      ppl: litres > 0 ? Math.round(amount / litres * 1000) / 1000 : null,
      costPerKm: km > 0 ? Math.round(amount / km * 1000) / 1000 : null,
      startOdo: Number(first.odometer) - (first.distance || 0),
      endOdo: Number(last.odometer)
    };
  }

  /** Mileage stored on a claim, or worked out from its receipts for older claims. */
  function claimMileage(c) {
    if (c.mileage) return c.mileage;
    var e = efficiency(c.receipts || []);
    if (!e) return null;
    var rs = (c.receipts || []).filter(function (r) { return Number(r.odometer); }).sort(function (a, b) { return Number(a.odometer) - Number(b.odometer); });
    var t = S.totals(c.receipts);
    return { km: e.km, kmpl: Math.round(e.kmpl * 10) / 10, ppl: t.litres > 0 ? Math.round(t.amount / t.litres * 1000) / 1000 : null,
      costPerKm: null, startOdo: Number(rs[0].odometer), endOdo: Number(rs[rs.length - 1].odometer) };
  }

  function mileageCard(m) {
    if (!m) return "";
    return '<div class="card flush totals" style="margin-top:10px"><div><span>Distance driven</span><b>' + Number(m.km).toLocaleString() + " km</b></div>" +
      "<div><span>Average mileage</span><b>" + (m.kmpl ? m.kmpl.toFixed(1) + " km/L" : "—") + "</b></div>" +
      "<div><span>Average price</span><b>" + (m.ppl ? m.ppl.toFixed(3) + " KD/L" : "—") + "</b></div></div>" +
      '<p class="sub" style="font-size:12.5px;margin:6px 0 0">Odometer ' + Number(m.startOdo).toLocaleString() + " → " + Number(m.endOdo).toLocaleString() + " km" +
      (m.costPerKm ? " · " + m.costPerKm.toFixed(3) + " KD per km" : "") + "</p>";
  }

  function claimNoOf(id) {
    var c = findClaim(id);
    return c ? c.claimNo : "";
  }

  function billRow(b) {
    var mil = [];
    if (b.distance) mil.push("+" + b.distance.toLocaleString() + " km");
    if (b.kmpl) mil.push(b.kmpl.toFixed(1) + " km/L");
    return '<button class="receipt bill" data-act="open-bill" data-id="' + esc(b.id) + '"><span class="thumb" data-thumb="' + esc(b.photoId || "") + '" data-claim="">' + (b.photoId ? "" : "No photo") + "</span>" +
      '<span class="main"><b>' + (isOffice() && b.ownerUid && b.ownerUid !== st.user.uid ? esc(b.driverName || "") + " · " : "") + esc(b.station || "—") + "</b><span>" + esc(fmtDate(b.date)) + " · " + (b.odometer ? Number(b.odometer).toLocaleString() + " km" : "") + "</span>" +
      (mil.length ? '<span class="mil">' + esc(mil.join(" · ")) + "</span>" : "") +
      '<span class="tag ' + (b.claimId ? "in" : "") + '">' + (b.claimId ? "In " + esc(claimNoOf(b.claimId)) : "Not claimed yet") + "</span></span>" +
      '<span class="amt">' + kd(b.amount) + " KD<small>" + lit(b.litres) + " L</small></span></button>";
  }

  function viewBills() {
    var all = billsWithMileage(), open = all.filter(function (b) { return !b.claimId; }).length;
    var h = '<div class="spread"><h1>Fuel bills</h1><button class="btn small primary" data-act="add-bill">' + ICON.plus + "Add bill</button></div>" +
      '<p class="sub">' + plural(all.length, "bill") + " · " + open + " not claimed yet</p>";
    if (!all.length) return h + '<div class="card empty"><b>No fuel bills yet</b>Tap "Add bill" after you fill up, and take a photo of the bill.</div>';
    var months = {};
    all.forEach(function (b) { (months[monthOf(b.date)] = months[monthOf(b.date)] || []).push(b); });
    Object.keys(months).sort().reverse().forEach(function (m) {
      var list = months[m];
      h += '<div class="section-title"><h2>' + esc(monthLabel(m)) + '</h2><a href="' + myHref("reports") + "/" + m + '">Report</a></div>' +
        '<p class="sub" style="margin:-4px 0 8px;font-size:13px">' + plural(list.length, "bill") + " · " + sum(list, function (b) { return b.distance || 0; }).toLocaleString() + " km · " +
        lit(sum(list, function (b) { return Number(b.litres) || 0; })) + " L · " + kd(sum(list, function (b) { return Number(b.amount) || 0; })) + " KD</p>" +
        '<div class="card flush">' + list.slice().reverse().map(billRow).join("") + "</div>";
    });
    return h;
  }

  function billSheet(id) {
    var all = billsWithMileage(), other = false;
    if (id && isOffice() && !st.bills.some(function (x) { return x.id === id; })) {
      var owner = (st.allBills.filter(function (x) { return x.id === id; })[0] || {}).ownerUid;
      all = billsWithMileage(st.allBills.filter(function (x) { return x.ownerUid === owner; }));
      other = true;
    }
    var b = id ? all.filter(function (x) { return x.id === id; })[0] : null;
    if (id && !b) return;
    var locked = !!(b && b.claimId) || other;
    var r = b ? { id: b.id, date: b.date, station: b.station, odometer: b.odometer, litres: b.litres, amount: b.amount, photoId: b.photoId, createdAt: b.createdAt, claimId: b.claimId }
      : { date: today(), station: "", odometer: "", litres: "", amount: "", photoId: "" };
    var stations = {};
    all.forEach(function (x) { if (x.station) stations[x.station] = 1; });
    var newPhoto = null;
    var dis = locked ? " disabled" : "";
    var h = "<h2>" + (b ? (locked ? "Fuel bill" : "Edit fuel bill") : "Add fuel bill") + "</h2>" +
      (locked ? '<div class="banner info" style="margin-bottom:12px">' + (other ? esc(b.driverName || "") + (b.claimId ? " · in claim " + esc(claimNoOf(b.claimId)) : " · not claimed yet") + (b.distance ? " · " + b.distance.toLocaleString() + " km since the previous bill" : "") : "This bill is in claim " + esc(claimNoOf(b.claimId)) + ", so it can't be changed.") + "</div>" : "") +
      '<div class="stack"><div class="photo-pick"><span id="r-prev">' + (r.photoId ? '<img alt="Bill photo" id="r-img">' : '<span class="ph">' + ICON.camera + "</span>") + "</span>" +
      '<div class="grow"><b>Bill photo</b><div style="font-size:12.5px;color:var(--muted)">Lay the bill flat in good light.</div>' +
      (locked ? "" : '<div class="row" style="margin-top:8px"><label class="btn small primary">' + ICON.camera + 'Take photo<input type="file" accept="image/*" capture="environment" id="r-cam" hidden></label><label class="btn small">Choose<input type="file" accept="image/*" id="r-file" hidden></label></div>') + "</div></div>" +
      '<div class="grid2">' + field("r-date", "Date", "date", r.date, 'max="' + today() + '"' + dis) + field("r-odo", "Odometer (km)", "number", r.odometer, 'inputmode="numeric" min="0" step="1"' + dis) + "</div>" +
      '<div class="hint" id="r-odo-hint" style="font-size:12.5px;color:var(--muted);margin-top:-6px"></div>' +
      '<div class="field" data-f="r-station"><label for="f-r-station">Fuel station</label><input id="f-r-station" list="stations" value="' + esc(r.station) + '" placeholder="e.g. KNPC Salmiya"' + dis + '><datalist id="stations">' +
      Object.keys(stations).map(function (x) { return '<option value="' + esc(x) + '">'; }).join("") + "</datalist></div>" +
      '<div class="grid2">' + field("r-litres", "Litres", "number", r.litres, 'inputmode="decimal" min="0" step="0.01"' + dis) + field("r-amount", "Amount (KD)", "number", r.amount, 'inputmode="decimal" min="0" step="0.001"' + dis) + "</div>" +
      '<div class="calc" id="r-calc"></div><div id="r-msg" class="banner bad" hidden></div>' +
      '<div class="btn-row">' + (locked ? '<button class="btn" data-close>Close</button>' :
        (b ? '<button class="btn bad" id="r-del">Delete</button>' : '<button class="btn" data-close>Cancel</button>') + '<button class="btn primary" id="r-save">Save bill</button>') + "</div></div>";

    // previous and next bill around a date (ignoring this bill) for the odometer check
    function neighbours(date) {
      var others = all.filter(function (x) { return !b || x.id !== b.id; });
      var before = others.filter(function (x) { return (x.date || "") <= date; }), after = others.filter(function (x) { return (x.date || "") > date; });
      return { prev: before[before.length - 1] || null, next: after[0] || null };
    }

    sheet(h, function (el, close) {
      if (r.photoId) getPhoto(null, r.photoId).then(function (src) { var i = el.querySelector("#r-img"); if (i && src) i.src = src; });
      function calc() {
        var date = el.querySelector("#f-r-date").value, odo = Number(el.querySelector("#f-r-odo").value);
        var litres = Number(el.querySelector("#f-r-litres").value), amount = Number(el.querySelector("#f-r-amount").value);
        var nb = neighbours(date), hint = el.querySelector("#r-odo-hint"), out = [];
        hint.textContent = nb.prev ? "Last bill: " + Number(nb.prev.odometer).toLocaleString() + " km on " + fmtDate(nb.prev.date) : "This is your first bill.";
        if (nb.prev && odo > Number(nb.prev.odometer)) {
          var dist = odo - Number(nb.prev.odometer);
          out.push("<b>" + dist.toLocaleString() + " km</b> since the last bill");
          if (litres > 0) out.push("<b>" + (dist / litres).toFixed(1) + " km/L</b>");
        }
        if (litres > 0 && amount > 0) out.push((amount / litres).toFixed(3) + " KD per litre");
        el.querySelector("#r-calc").innerHTML = out.join(" · ");
      }
      el.addEventListener("input", calc);
      calc();
      function onFile(e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        compressImage(f).then(function (data) {
          newPhoto = data;
          el.querySelector("#r-prev").innerHTML = '<img alt="Bill photo" src="' + data + '">';
        }).catch(function (err) { toast(err.message); });
      }
      if (!locked) {
        el.querySelector("#r-cam").onchange = onFile;
        el.querySelector("#r-file").onchange = onFile;
      }
      var del = el.querySelector("#r-del");
      if (del) del.onclick = function () {
        S.deleteBill(b.id).then(function () { close(); toast("Bill deleted"); }).catch(function (e) { toast(e.message); });
      };
      var save = el.querySelector("#r-save");
      if (save) save.onclick = function () {
        var btn = this, m = el.querySelector("#r-msg");
        r.date = el.querySelector("#f-r-date").value;
        r.station = el.querySelector("#f-r-station").value.trim();
        r.odometer = el.querySelector("#f-r-odo").value ? Math.round(Number(el.querySelector("#f-r-odo").value)) : "";
        r.litres = el.querySelector("#f-r-litres").value ? Math.round(Number(el.querySelector("#f-r-litres").value) * 100) / 100 : "";
        r.amount = el.querySelector("#f-r-amount").value ? Math.round(Number(el.querySelector("#f-r-amount").value) * 1000) / 1000 : "";
        var miss = [];
        if (!newPhoto && !r.photoId) miss.push("bill photo");
        if (!r.date) miss.push("date");
        if (!(r.odometer > 0)) miss.push("odometer");
        if (!r.station) miss.push("fuel station");
        if (!(r.litres > 0)) miss.push("litres");
        if (!(r.amount > 0)) miss.push("amount");
        m.hidden = true;
        if (miss.length) {
          m.hidden = false;
          m.textContent = "Please add the " + miss.join(", ") + ".";
          return;
        }
        if (r.date > today()) { m.hidden = false; m.textContent = "The date can't be in the future."; return; }
        var nb = neighbours(r.date);
        if (nb.prev && r.odometer <= Number(nb.prev.odometer)) {
          m.hidden = false;
          m.textContent = "The odometer must be higher than your last bill (" + Number(nb.prev.odometer).toLocaleString() + " km on " + fmtDate(nb.prev.date) + "). Check the reading.";
          return;
        }
        if (nb.next && r.odometer >= Number(nb.next.odometer)) {
          m.hidden = false;
          m.textContent = "The odometer must be lower than the later bill (" + Number(nb.next.odometer).toLocaleString() + " km on " + fmtDate(nb.next.date) + "). Check the date and reading.";
          return;
        }
        btn.disabled = true;
        btn.textContent = "Saving…";
        var before = st.bills.filter(function (x) { return !x.claimId; }).length;
        (newPhoto ? S.savePhoto(null, newPhoto).then(function (pid) { st.photoCache[pid] = newPhoto; r.photoId = pid; }) : Promise.resolve())
          .then(function () { return S.saveBill(r); })
          .then(function () {
            close();
            var after = before + (b ? 0 : 1);
            toast(!b && after === CLAIM_SIZE ? CLAIM_SIZE + " bills ready. You can create a claim now." : "Bill saved");
          })
          .catch(function (e) {
            btn.disabled = false;
            btn.textContent = "Save bill";
            toast(e.message);
          });
      };
    });
  }

  // ---- create a claim from 10 bills ----

  function viewMakeClaim() {
    var open = billsWithMileage().filter(function (b) { return !b.claimId; });
    if (open.length < CLAIM_SIZE) {
      return '<h1>Create claim</h1><div class="card empty"><b>' + open.length + " of " + CLAIM_SIZE + " bills</b>A claim needs " + CLAIM_SIZE + " fuel bills. Add " + (CLAIM_SIZE - open.length) + " more.<div style=\"margin-top:14px\"><button class=\"btn primary\" data-act=\"add-bill\">Add fuel bill</button></div></div>";
    }
    var chosen = open.slice(0, CLAIM_SIZE), u = st.user;
    var litres = sum(chosen, function (b) { return Number(b.litres) || 0; }), amount = sum(chosen, function (b) { return Number(b.amount) || 0; });
    var h = "<h1>Create claim</h1><p class=\"sub\">Your oldest " + CLAIM_SIZE + " bills, " + esc(fmtDate(chosen[0].date)) + " – " + esc(fmtDate(chosen[chosen.length - 1].date)) + "</p>" +
      '<div class="card flush totals"><div><span>Bills</span><b>' + chosen.length + "</b></div><div><span>Litres</span><b>" + lit(litres) + "</b></div><div><span>Total</span><b>" + kd(amount) + " KD</b></div></div>" +
      mileageCard(mileageOf(chosen)) +
      '<div class="section-title"><h2>Bills in this claim</h2></div><div class="card flush">' + chosen.map(billRow).join("") + "</div>" +
      '<div class="card stack" style="margin-top:14px"><div class="eyebrow">Driver declaration</div>' +
      '<label class="check"><input type="checkbox" id="decl"><span>I confirm that all fuel receipts listed above relate to the company vehicle and that the information provided is correct. All original receipts are attached.</span></label>' +
      '<div class="field"><label>Your signature</label>' +
      (u.signature ? '<div class="row"><img class="sig-img" alt="Your saved signature" src="' + esc(u.signature) + '"><button type="button" class="link" data-act="change-sig">Change</button></div><span class="hint">Your saved signature is added to the claim.</span>'
        : '<div class="sig" id="d-sig"><canvas></canvas><div class="base"></div><div class="ph">Sign here with your finger</div></div><div class="spread"><span class="hint">Saved for your next claims, so you only sign once.</span><button type="button" class="link" data-act="sig-clear">Clear</button></div>') +
      "</div></div>" +
      '<div id="submit-msg" class="banner bad" style="margin-top:14px" hidden></div>' +
      '<div class="sticky-actions"><a class="btn" href="#/home">Cancel</a><button class="btn primary" data-act="create-claim">Create claim &amp; PDF</button></div>';
    return h;
  }

  function createClaim() {
    var open = billsWithMileage().filter(function (b) { return !b.claimId; }).slice(0, CLAIM_SIZE);
    var msg = document.getElementById("submit-msg"), problems = [];
    var sig = st.user.signature || (draftPad && !draftPad.isEmpty() ? draftPad.toDataURL() : "");
    if (!document.getElementById("decl").checked) problems.push("Tick the declaration to confirm.");
    if (!sig) problems.push("Sign in the signature box.");
    if (problems.length) {
      msg.hidden = false;
      msg.innerHTML = problems.map(esc).join("<br>");
      return;
    }
    var btn = document.querySelector('[data-act="create-claim"]');
    btn.disabled = true;
    btn.textContent = "Creating…";
    (st.user.signature ? Promise.resolve() : S.updateProfile({ signature: sig })).then(function () {
      return S.createClaim(open.map(function (b) { return b.id; }), { signature: sig, mileage: mileageOf(open) }, st.bills);
    }).then(function (c) {
      st.justFinished = c.id;
      toast("Claim created");
      go("#/claim/" + c.id);
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = "Create claim & PDF";
      toast(e.message);
    });
  }

  function signatureSheet() {
    sheet('<h2>Your signature</h2><p class="sub" style="margin-top:-6px">It goes on every claim you create.</p><div class="stack">' +
      '<div class="sig" id="s-sig"><canvas></canvas><div class="base"></div><div class="ph">Sign here with your finger</div></div>' +
      '<div class="btn-row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="s-save">Save signature</button></div></div>', function (el, close) {
      var pad = signaturePad(el.querySelector("#s-sig"));
      el.querySelector("#s-save").onclick = function () {
        if (pad.isEmpty()) { toast("Please sign first."); return; }
        S.updateProfile({ signature: pad.toDataURL() }).then(function () { close(); toast("Signature saved"); route(); });
      };
    });
  }

  // ---- monthly report ----

  function monthReport(m, source, claimsSource) {
    var all = billsWithMileage(source), list = all.filter(function (b) { return monthOf(b.date) === m; });
    var t = {
      count: list.length,
      km: sum(list, function (b) { return b.distance || 0; }),
      litres: sum(list, function (b) { return Number(b.litres) || 0; }),
      amount: sum(list, function (b) { return Number(b.amount) || 0; }),
      claimed: list.filter(function (b) { return b.claimId; }).length
    };
    var withKm = list.filter(function (b) { return b.distance; });
    var kmLitres = sum(withKm, function (b) { return Number(b.litres) || 0; });
    t.kmpl = kmLitres > 0 ? t.km / kmLitres : null;
    t.ppl = t.litres > 0 ? t.amount / t.litres : null;
    var claims = (claimsSource || st.mine).filter(function (c) { return monthOf(c.submissionDate) === m || list.some(function (b) { return b.claimId === c.id; }); });
    return { month: m, label: monthLabel(m), bills: list, totals: t, claims: claims };
  }

  function viewReports(m) {
    var months = {};
    st.bills.forEach(function (b) { if (b.date) months[monthOf(b.date)] = 1; });
    var keys = Object.keys(months).sort().reverse();
    if (!keys.length) return '<h1>Monthly report</h1><div class="card empty"><b>No bills yet</b>Your monthly fuel report appears here once you add fuel bills.</div>';
    if (!m || keys.indexOf(m) < 0) m = keys[0];
    var rep = monthReport(m), t = rep.totals;
    var h = '<h1>Monthly report</h1><p class="sub">All your fuel bills for a month, as a PDF to share.</p>' +
      '<div class="chips" style="margin-bottom:14px">' + keys.map(function (k) { return '<a class="chip' + (k === m ? " on" : "") + '" href="' + myHref("reports") + "/" + k + '">' + esc(monthLabel(k)) + "</a>"; }).join("") + "</div>" +
      '<div class="kpis">' + kpi("Distance driven", t.km.toLocaleString(), "km", plural(t.count, "bill")) + kpi("Fuel cost", kd(t.amount), "KD", lit(t.litres) + " litres") +
      kpi("Average", t.kmpl ? t.kmpl.toFixed(1) : "—", "km/L", t.ppl ? t.ppl.toFixed(3) + " KD per litre" : "") +
      kpi("Claimed", t.claimed + " / " + t.count, "", plural(rep.claims.length, "claim")) + "</div>" +
      '<div class="card stack" style="margin-top:14px"><label class="check"><input type="checkbox" id="rep-photos" checked><span>Include the bill photos in the PDF</span></label>' +
      '<div class="btn-row"><button class="btn primary" data-act="report-share" data-m="' + m + '">' + (canShare() ? ICON.whatsapp + "Share on WhatsApp" : ICON.share + "Share PDF") + "</button>" +
      '<button class="btn" data-act="report-pdf" data-m="' + m + '">' + ICON.pdf + "Download PDF</button></div></div>" +
      '<div class="section-title"><h2>Bills in ' + esc(rep.label) + '</h2></div><div class="card flush">' + rep.bills.slice().reverse().map(billRow).join("") + "</div>";
    return h;
  }

  function makeReportPdf(m, driverUid) {
    var profile = st.user, rep;
    if (driverUid && isOffice()) {
      rep = monthReport(m, st.allBills.filter(function (b) { return b.ownerUid === driverUid; }), st.all.filter(function (c) { return c.ownerUid === driverUid; }));
      profile = st.users.filter(function (u) { return u.uid === driverUid; })[0] || { name: (rep.bills[0] || {}).driverName || "" };
    } else {
      rep = monthReport(m);
    }
    var withPhotos = document.getElementById("rep-photos") ? document.getElementById("rep-photos").checked : true;
    toast("Preparing PDF…");
    return Promise.all(rep.bills.map(function (b) { return withPhotos ? getPhoto(null, b.photoId) : null; })).then(function (photos) {
      rep.bills.forEach(function (b) { b.claimNo = b.claimId ? claimNoOf(b.claimId) : ""; });
      return P.buildMonthly(rep, photos, profile, C, S.STATUS).output("blob");
    });
  }

  // ------------------------------------------------------------------ office (online, role "admin")

  function drivers() {
    var byUid = {};
    st.users.forEach(function (u) { if (!u.pending) byUid[u.uid] = { uid: u.uid, name: u.name, vehicle: u.vehicle, employeeId: u.employeeId, active: u.active !== false }; });
    st.allBills.forEach(function (b) { if (!byUid[b.ownerUid]) byUid[b.ownerUid] = { uid: b.ownerUid, name: b.driverName || "Driver", vehicle: "", active: true }; });
    return Object.keys(byUid).map(function (k) { return byUid[k]; }).sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
  }

  function driverStats(d) {
    var month = monthOf(today());
    var bills = billsWithMileage(st.allBills.filter(function (b) { return b.ownerUid === d.uid; }));
    var open = bills.filter(function (b) { return !b.claimId; });
    var monthBills = bills.filter(function (b) { return monthOf(b.date) === month; });
    var waiting = st.all.filter(function (c) { return c.ownerUid === d.uid && (c.status === "submitted" || c.status === "verified" || c.status === "approved"); });
    var last = bills[bills.length - 1];
    return {
      open: open.length, openKd: sum(open, function (b) { return Number(b.amount) || 0; }), openMileage: mileageOf(open.slice(0, CLAIM_SIZE)),
      month: mileageOf(monthBills), monthKd: sum(monthBills, function (b) { return Number(b.amount) || 0; }), monthCount: monthBills.length,
      waiting: waiting.length, waitingKd: sum(waiting), lastOdo: last ? Number(last.odometer) : null, lastDate: last ? last.date : null
    };
  }

  function viewOfficeOnline() {
    var month = monthOf(today()), ds = drivers();
    var waiting = st.all.filter(function (c) { return c.status === "submitted"; });
    var verified = st.all.filter(function (c) { return c.status === "verified"; });
    var toPay = st.all.filter(function (c) { return c.status === "approved"; });
    var forMe = st.all.filter(function (c) { var a = claimActions(c); return a.indexOf("verify") >= 0 || a.indexOf("approve") >= 0; });
    var pending = isAdmin() ? st.users.filter(function (u) { return u.pending && u.active === false && u.role !== "admin"; }) : [];
    var paidMonth = st.all.filter(function (c) { return c.status === "paid" && c.paidAt && monthOf(new Date(c.paidAt).toISOString()) === month; });
    var monthBills = billsWithMileage(st.allBills).filter(function (b) { return monthOf(b.date) === month; });
    var h = "<h1>" + esc(S.ROLE_LABELS[role()] || "Office") + ' dashboard</h1><p class="sub">Live from everyone using the app · ' + esc(monthLabel(month)) + "</p>";
    var inNow = st.allAtt.filter(function (e) { return !e.outAt; }), otWait = st.allOt.filter(function (o) { return o.status === "pending" && o.ownerUid !== st.user.uid; });
    h += '<div class="kpis" style="margin-bottom:10px">' + kpi("At work now", inNow.length, "", tcfg().warehouses.map(function (w) {
      return w.name + " " + inNow.filter(function (e) { return e.warehouse === w.id; }).length; }).join(" · ")) +
      kpi("Overtime to approve", otWait.length, "", hm(sum(otWait, function (o) { return o.otMin; })), otWait.length > 0) + "</div>" +
      '<div class="btn-row" style="margin-bottom:6px"><a class="btn" href="#/time/now">' + ICON.clock + 'Who\'s in</a><a class="btn" href="#/time/ot">Approve overtime</a></div>' +
      '<div class="section-title"><h2>Fuel</h2><a href="#/reports">Monthly reports</a></div>';
    if (pending.length) {
      h += '<div class="card stack" style="margin-bottom:14px;border-left:4px solid var(--warn)"><div class="spread"><h2>' + plural(pending.length, "person") .replace("persons", "people") + " waiting to be allowed</h2></div>" +
        pending.map(function (u) {
          return '<div class="spread"><div><b>' + esc(u.name) + '</b><div class="sub" style="margin:0;font-size:13px">' + esc(u.email || "") + " · " + esc(u.employeeId || "no ID") + " · " + esc(u.vehicle || "no vehicle") + "</div></div>" +
            '<div class="row"><button class="btn small good" data-act="allow-user" data-uid="' + esc(u.uid) + '">Allow</button><a class="btn small" href="#/users">Details</a></div></div>';
        }).join("") + "</div>";
    }
    if (st.allError) h += '<div class="banner bad" style="margin-bottom:14px">' + esc(st.allError) + "</div>";
    h += '<div class="kpis">' +
      kpi("Drivers", ds.filter(function (d) { return d.active; }).length, "", ds.filter(function (d) { return driverStats(d).open >= CLAIM_SIZE; }).length + " ready to claim") +
      kpi("To verify", waiting.length, "", kd(sum(waiting)) + " KD", waiting.length > 0 && !canApprove()) +
      kpi("Verified, to approve", verified.length, "", kd(sum(verified)) + " KD", verified.length > 0 && canApprove()) +
      kpi("Approved, to pay", kd(sum(toPay)), "KD", plural(toPay.length, "claim")) + "</div><div class=\"kpis\" style=\"margin-top:10px\">" +
      kpi("Fuel this month", kd(sum(monthBills, function (b) { return Number(b.amount) || 0; })), "KD", plural(monthBills.length, "bill")) + "</div>";

    h += '<div class="section-title"><h2>Drivers</h2><span class="row"><button class="btn small" data-act="bills-csv">' + ICON.pdf + 'Bills (Excel)</button><button class="btn small" data-act="claims-csv">' + ICON.pdf + "Claims (Excel)</button></span></div>";
    if (!ds.length) {
      h += '<div class="card empty"><b>No drivers yet</b>Drivers appear here once they create their account in the app.</div>';
    } else {
      h += '<div class="card flush table-wrap"><table><thead><tr><th>Driver</th><th>Next claim</th><th class="r">New bills KD</th><th class="r">Last odometer</th><th class="r">Km this month</th><th class="r">km/L this month</th><th class="r">Waiting KD</th></tr></thead><tbody>' +
        ds.map(function (d) {
          var x = driverStats(d), n = Math.min(x.open, CLAIM_SIZE);
          return '<tr><td><a href="#/all-bills/' + esc(d.uid) + '"><b>' + esc(d.name) + "</b></a><br><span class=\"sub\" style=\"font-size:12px\">" + esc(d.vehicle || "") + (d.active ? "" : " · turned off") + "</span></td>" +
            '<td><div class="meter small-meter"><span style="width:' + Math.round(n / CLAIM_SIZE * 100) + '%"></span></div><span style="font-size:12.5px">' + x.open + " / " + CLAIM_SIZE + (x.open >= CLAIM_SIZE ? " · ready" : "") + "</span></td>" +
            '<td class="r">' + kd(x.openKd) + '</td><td class="r">' + (x.lastOdo ? x.lastOdo.toLocaleString() + "<br><span class=\"sub\" style=\"font-size:12px\">" + esc(fmtDate(x.lastDate)) + "</span>" : "—") + "</td>" +
            '<td class="r">' + (x.month ? x.month.km.toLocaleString() : "0") + '</td><td class="r">' + (x.month && x.month.kmpl ? x.month.kmpl.toFixed(1) : "—") + "</td>" +
            '<td class="r">' + (x.waiting ? kd(x.waitingKd) + "<br><span class=\"sub\" style=\"font-size:12px\">" + plural(x.waiting, "claim") + "</span>" : "—") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }
    h += '<div class="section-title"><h2>' + (canApprove() ? "Claims to verify and approve" : "Claims to verify") + '</h2><a href="#/claims">All claims</a></div>';
    h += forMe.length ? '<div class="card flush list">' + forMe.map(function (c) { return claimItem(c, false, true); }).join("") + "</div>"
      : '<div class="card empty"><b>Nothing waiting for you</b>New claims from drivers appear here straight away.</div>';
    if (toPay.length && canApprove()) {
      h += '<div class="section-title"><h2>Approved, to pay</h2></div><div class="card flush list">' + toPay.map(function (c) { return claimItem(c, false, true); }).join("") + "</div>";
    }
    var latest = billsWithMileage(st.allBills).slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).slice(0, 8);
    h += '<div class="section-title"><h2>Latest bills</h2><a href="#/all-bills">All bills</a></div>';
    h += latest.length ? '<div class="card flush">' + latest.map(billRow).join("") + "</div>" : '<div class="card empty"><b>No bills yet</b></div>';
    return h;
  }

  function viewAllBills(uid) {
    var ds = drivers(), sel = uid || "all";
    var pool = sel === "all" ? st.allBills : st.allBills.filter(function (b) { return b.ownerUid === sel; });
    // mileage is worked out per driver
    var withKm = [];
    ds.forEach(function (d) { withKm = withKm.concat(billsWithMileage(st.allBills.filter(function (b) { return b.ownerUid === d.uid; }))); });
    var list = withKm.filter(function (b) { return pool.indexOf(st.allBills.filter(function (x) { return x.id === b.id; })[0]) >= 0; })
      .sort(function (a, b) { return (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0); });
    var h = '<div class="spread"><h1>All bills</h1><button class="btn small" data-act="bills-csv">' + ICON.pdf + "Export Excel (CSV)</button></div>" +
      '<p class="sub">' + plural(list.length, "bill") + " · " + kd(sum(list, function (b) { return Number(b.amount) || 0; })) + " KD · " + list.filter(function (b) { return !b.claimId; }).length + " not claimed yet</p>" +
      '<div class="chips" style="margin-bottom:12px"><a class="chip' + (sel === "all" ? " on" : "") + '" href="#/all-bills">All drivers</a>' +
      ds.map(function (d) { return '<a class="chip' + (sel === d.uid ? " on" : "") + '" href="#/all-bills/' + esc(d.uid) + '">' + esc(d.name) + "</a>"; }).join("") + "</div>";
    if (sel !== "all") {
      var x = driverStats(ds.filter(function (d) { return d.uid === sel; })[0] || { uid: sel });
      h += '<div class="kpis" style="margin-bottom:12px">' + kpi("Next claim", Math.min(x.open, CLAIM_SIZE) + " / " + CLAIM_SIZE, "", kd(x.openKd) + " KD") +
        kpi("Last odometer", x.lastOdo ? x.lastOdo.toLocaleString() : "—", "km", x.lastDate ? fmtDate(x.lastDate) : "") +
        kpi("This month", x.month ? x.month.km.toLocaleString() : "0", "km", x.month && x.month.kmpl ? x.month.kmpl.toFixed(1) + " km/L" : "") +
        kpi("Waiting for payment", kd(x.waitingKd), "KD", plural(x.waiting, "claim")) + "</div>" +
        '<div style="margin-bottom:12px"><a class="btn small" href="#/reports/' + monthOf(today()) + "/" + esc(sel) + '">Monthly report for this driver</a></div>';
    }
    h += list.length ? '<div class="card flush">' + list.map(billRow).join("") + "</div>" : '<div class="card empty"><b>No bills</b></div>';
    return h;
  }

  function viewAllClaims() {
    var f = st.filter.status, keys = ["all", "submitted", "verified", "approved", "paid", "returned", "rejected"];
    var counts = {};
    st.all.forEach(function (c) { counts[c.status] = (counts[c.status] || 0) + 1; });
    var list = st.all.filter(function (c) { return f === "all" || c.status === f; });
    var h = '<div class="spread"><h1>All claims</h1><button class="btn small" data-act="claims-csv">' + ICON.pdf + "Export Excel (CSV)</button></div>" +
      '<p class="sub">' + plural(st.all.length, "claim") + " · " + kd(sum(st.all.filter(function (c) { return c.status === "paid"; }), paidAmt)) + ' KD paid</p><div class="chips" style="margin-bottom:14px">';
    keys.forEach(function (k) {
      h += '<button class="chip' + (f === k ? " on" : "") + '" data-act="filter-status" data-v="' + k + '">' + (k === "all" ? "All" : k === "submitted" ? "To verify" : k === "verified" ? "Verified, to approve" : k === "approved" ? "Approved, to pay" : S.STATUS[k].label) + '<span class="n">' + (k === "all" ? st.all.length : counts[k] || 0) + "</span></button>";
    });
    h += "</div>";
    return h + (list.length ? '<div class="card flush list">' + list.map(function (c) { return claimItem(c, false, true); }).join("") + "</div>" : '<div class="card empty"><b>No claims</b></div>');
  }

  function viewOfficeReports(m, uid) {
    var ds = drivers();
    if (!ds.length) return '<h1>Reports</h1><div class="card empty"><b>No drivers yet</b></div>';
    uid = uid || ds[0].uid;
    var src = st.allBills.filter(function (b) { return b.ownerUid === uid; });
    var months = {};
    src.forEach(function (b) { if (b.date) months[monthOf(b.date)] = 1; });
    var keys = Object.keys(months).sort().reverse();
    if (!m || keys.indexOf(m) < 0) m = keys[0] || monthOf(today());
    var rep = monthReport(m, src, st.all.filter(function (c) { return c.ownerUid === uid; })), t = rep.totals;
    var h = '<h1>Monthly reports</h1><p class="sub">Pick a driver and a month, then download or share the PDF.</p>' +
      '<div class="chips" style="margin-bottom:10px">' + ds.map(function (d) { return '<a class="chip' + (d.uid === uid ? " on" : "") + '" href="#/reports/' + m + "/" + esc(d.uid) + '">' + esc(d.name) + "</a>"; }).join("") + "</div>" +
      '<div class="chips" style="margin-bottom:14px">' + (keys.length ? keys.map(function (k) { return '<a class="chip' + (k === m ? " on" : "") + '" href="#/reports/' + k + "/" + esc(uid) + '">' + esc(monthLabel(k)) + "</a>"; }).join("") : '<span class="sub">No bills yet</span>') + "</div>" +
      '<div class="kpis">' + kpi("Distance driven", t.km.toLocaleString(), "km", plural(t.count, "bill")) + kpi("Fuel cost", kd(t.amount), "KD", lit(t.litres) + " litres") +
      kpi("Average", t.kmpl ? t.kmpl.toFixed(1) : "—", "km/L", t.ppl ? t.ppl.toFixed(3) + " KD per litre" : "") + kpi("Claimed", t.claimed + " / " + t.count, "", plural(rep.claims.length, "claim")) + "</div>" +
      '<div class="card stack" style="margin-top:14px"><label class="check"><input type="checkbox" id="rep-photos" checked><span>Include the bill photos in the PDF</span></label>' +
      '<div class="btn-row"><button class="btn primary" data-act="report-pdf" data-m="' + m + '" data-driver="' + esc(uid) + '">' + ICON.pdf + "Download PDF</button>" +
      (canShare() ? '<button class="btn" data-act="report-share" data-m="' + m + '" data-driver="' + esc(uid) + '">' + ICON.share + "Share PDF</button>" : "") + "</div></div>" +
      '<div class="section-title"><h2>Bills in ' + esc(rep.label) + '</h2></div><div class="card flush">' + (rep.bills.length ? rep.bills.slice().reverse().map(billRow).join("") : '<div class="empty">No bills this month</div>') + "</div>";
    return h;
  }

  function csvLine(r) {
    return r.map(function (v) {
      v = String(v === undefined || v === null ? "" : v);
      if (/^[=+\-@]/.test(v)) v = "'" + v;
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(",");
  }

  function exportBillsCsv() {
    var rows = [["Driver", "Employee ID", "Vehicle", "Date", "Fuel Station", "Odometer (km)", "Distance since previous (km)", "Litres", "Amount (KD)", "km/L", "KD per litre", "Claim No", "Photo"]];
    drivers().forEach(function (d) {
      billsWithMileage(st.allBills.filter(function (b) { return b.ownerUid === d.uid; })).forEach(function (b) {
        rows.push([d.name, d.employeeId || "", d.vehicle || "", b.date, b.station, b.odometer, b.distance || "", lit(b.litres), kd(b.amount),
          b.kmpl ? b.kmpl.toFixed(1) : "", b.ppl ? b.ppl.toFixed(3) : "", b.claimId ? claimNoOf(b.claimId) : "", b.photoId ? "Yes" : "No"]);
      });
    });
    saveFile(new Blob(["\ufeff" + rows.map(csvLine).join("\r\n")], { type: "text/csv" }), "Fuel bills " + today() + ".csv");
  }

  function exportClaimsCsv() {
    var rows = [["Claim No", "Driver", "Employee ID", "Vehicle", "Period From", "Period To", "Submitted", "Bills", "Litres", "Amount (KD)", "Distance (km)", "Average km/L", "Status", "Verified By", "Approved KD", "Approved By", "Paid On", "Paid Amount (KD)", "Payment Ref", "Remarks"]];
    st.all.forEach(function (c) {
      var m = claimMileage(c);
      rows.push([c.claimNo, c.driverName, c.employeeId, c.vehicle, c.periodFrom, c.periodTo, c.submissionDate, c.totals.count, lit(c.totals.litres), kd(c.totals.amount),
        m ? m.km : "", m && m.kmpl ? m.kmpl.toFixed(1) : "", (S.STATUS[c.status] || {}).label || c.status,
        c.verifiedBy || "", c.approvedAt ? kd(c.amountApproved) : "", c.approvedBy || "",
        c.paidAt ? new Date(c.paidAt).toISOString().slice(0, 10) : "", c.status === "paid" ? kd(paidAmt(c)) : "", c.paidRef || "", c.remarks || ""]);
    });
    saveFile(new Blob(["\ufeff" + rows.map(csvLine).join("\r\n")], { type: "text/csv" }), "Fuel claims " + today() + ".csv");
  }

  // ---- upload what a driver saved on the phone before the app went online ----

  function uploadBanner() {
    if (LOCAL || !S.localData) return "";
    var d = S.localData();
    if (!d) return "";
    return '<div class="banner info stack" style="margin-bottom:14px"><div><b>' + plural(d.bills.length, "bill") + " and " + plural(d.claims.length, "claim") +
      "</b> saved on this phone aren't online yet. Upload them so the office can see them.</div>" +
      '<div class="btn-row"><button class="btn primary" data-act="upload-local">Upload now</button><button class="btn" data-act="skip-upload">Not these</button></div></div>';
  }

  function uploadLocal(btn) {
    btn.disabled = true;
    S.uploadLocal(function (done, total) { btn.textContent = "Uploading " + done + " / " + total + "…"; })
      .then(function (n) { toast("Uploaded " + n + " items"); route(); })
      .catch(function (e) { btn.disabled = false; btn.textContent = "Upload now"; toast(e.message); });
  }

  // ------------------------------------------------------------------ attendance & overtime (online only)

  var TIME_DEFAULTS = {
    warehouses: [{ id: "ardiya", name: "Ardiya" }, { id: "shuaiba", name: "Shuaiba" }, { id: "mina", name: "Mina Abdulla" }, { id: "yard", name: "Open Yard" }],
    shifts: [{ id: "morning", name: "Morning", start: "06:00", end: "16:00" }, { id: "day", name: "Day", start: "08:00", end: "18:00" }],
    ot: { standardHours: 10, daysPerMonth: 26, hoursPerDay: 8, normal: 1.25, rest: 1.5, holiday: 2, restDay: 5, roundMin: 15 },
    holidays: []
  };

  function tcfg() {
    var s = st.settings || {}, d = TIME_DEFAULTS;
    var ot = {};
    for (var k in d.ot) ot[k] = s.ot && s.ot[k] !== undefined && s.ot[k] !== "" ? Number(s.ot[k]) : d.ot[k];
    return { warehouses: s.warehouses && s.warehouses.length ? s.warehouses : d.warehouses, shifts: s.shifts && s.shifts.length ? s.shifts : d.shifts,
      ot: ot, holidays: s.holidays || [] };
  }
  function hm(min) {
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + "h " + ("0" + m).slice(-2) + "m" : m + "m";
  }
  function hours(min) { return (Math.round((min || 0) / 60 * 100) / 100).toFixed(2); }
  function clock(ms) { return ms ? new Date(ms).toTimeString().slice(0, 5) : "--:--"; }
  function dateOf(ms) { var d = new Date(ms); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function minsOf(hhmm) { var p = String(hhmm || "0:0").split(":"); return Number(p[0]) * 60 + Number(p[1] || 0); }
  function whName(id) { var w = tcfg().warehouses.filter(function (x) { return x.id === id; })[0]; return w ? w.name : id || "—"; }
  function userById(uid) { return uid === st.user.uid ? st.user : st.users.filter(function (u) { return u.uid === uid; })[0] || { uid: uid, name: "" }; }
  function shiftOf(u) { var sh = tcfg().shifts; return sh.filter(function (x) { return x.id === (u && u.shiftId); })[0] || sh[0]; }
  function shiftMin(sh) { var m = minsOf(sh.end) - minsOf(sh.start); return m <= 0 ? m + 1440 : m; }
  function shiftLabel(sh) { return sh.name + " " + sh.start + "–" + sh.end; }
  function dayType(date) {
    var c = tcfg();
    if (c.holidays.some(function (h) { return h.date === date; })) return "holiday";
    return new Date(date + "T12:00:00").getDay() === Number(c.ot.restDay) ? "rest" : "normal";
  }
  var DAY_LABEL = { normal: "", rest: "Friday / rest day", holiday: "Public holiday" };
  function holidayName(date) { var h = tcfg().holidays.filter(function (x) { return x.date === date; })[0]; return h ? h.name : ""; }

  /** Normal working minutes before overtime starts (company setting, 10 hours by default). */
  function standardMin() { return Math.round((Number(tcfg().ot.standardHours) || 10) * 60); }

  /** Worked minutes and overtime for one person on one day. OT = time beyond the normal working hours; on rest days and holidays all of it. */
  function dayCalc(entries, u, date, closedOnly) {
    var t = Date.now(), worked = 0;
    entries.forEach(function (e) {
      if (e.date !== date || (closedOnly && !e.outAt)) return;
      worked += Math.max(0, ((e.outAt || t) - e.inAt) / 60000);
    });
    worked = Math.round(worked);
    var sh = shiftOf(u), sched = standardMin(), type = dayType(date), round = Math.max(1, tcfg().ot.roundMin);
    var raw = type === "normal" ? Math.max(0, worked - sched) : worked;
    return { worked: worked, scheduled: type === "normal" ? sched : 0, ot: Math.floor(raw / round) * round, type: type, shift: shiftLabel(sh) };
  }

  function openEntry(entries, uid) {
    return entries.filter(function (e) { return e.ownerUid === uid && !e.outAt; }).sort(function (a, b) { return b.inAt - a.inAt; })[0] || null;
  }

  function getLocation() {
    return new Promise(function (res) {
      if (!navigator.geolocation) return res(null);
      var done = false, timer = setTimeout(function () { if (!done) { done = true; res(null); } }, 9000);
      navigator.geolocation.getCurrentPosition(function (p) {
        if (done) return;
        done = true; clearTimeout(timer);
        res({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, acc: Math.round(p.coords.accuracy) });
      }, function () { if (!done) { done = true; clearTimeout(timer); res(null); } }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
    });
  }
  function distM(a, b) {
    var R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
  }
  /** "at Ardiya (80 m)", "2.4 km from Ardiya", or "no location". */
  function locNote(whId, loc) {
    if (!loc) return { text: "No location", warn: true };
    var w = tcfg().warehouses.filter(function (x) { return x.id === whId; })[0];
    if (!w || !w.lat) return { text: "Location saved", warn: false };
    var d = distM(loc, w), radius = Number(w.radius) || 300;
    return d <= radius ? { text: "At site (" + d + " m)", warn: false } : { text: (d >= 1000 ? (d / 1000).toFixed(1) + " km" : d + " m") + " from " + w.name, warn: true };
  }
  function lateSync(e, which) {
    var srv = e[which + "Server"], t = e[which + "At"];
    var ms = srv && srv.toMillis ? srv.toMillis() : srv && srv.seconds ? srv.seconds * 1000 : null;
    return ms && t && ms - t > 10 * 60000;
  }

  /** Saves the day's worked time and OT so a supervisor can approve it. */
  function syncOtDay(uid, date, entries) {
    var u = userById(uid), c = dayCalc(entries.filter(function (e) { return e.ownerUid === uid; }), u, date, true);
    var pool = uid === st.user.uid ? st.ot : st.allOt;
    var ex = pool.filter(function (o) { return o.id === uid + "_" + date; })[0];
    if (ex && ex.workedMin === c.worked && ex.otMin === c.ot && ex.dayType === c.type) return Promise.resolve();
    if (!ex && c.ot <= 0) return Promise.resolve();
    if (ex && ex.status !== "pending" && uid === st.user.uid) return Promise.resolve();
    var doc = { ownerUid: uid, staffName: u.name || "", date: date, workedMin: c.worked, scheduledMin: c.scheduled, otMin: c.ot,
      dayType: c.type, shift: c.shift, status: "pending" };
    if (ex && ex.status !== "pending") doc.note = "Hours changed after the decision; please check again.";
    return S.saveOtDay(doc);
  }

  // ---- staff: clock in / out card ----

  function attendanceCard() {
    if (LOCAL) return "";
    var c = tcfg(), sh = shiftOf(st.user), open = openEntry(st.att, st.user.uid), td = today();
    var dc = dayCalc(st.att, st.user, td, false), type = dayType(td);
    var h = '<div class="card stack att-card' + (open ? " on" : "") + '"><div class="spread"><div><div class="eyebrow">Attendance · ' + esc(shiftLabel(sh)) + "</div>";
    if (open) {
      h += '<div class="att-where">At <b>' + esc(whName(open.warehouse)) + '</b> since ' + clock(open.inAt) + "</div></div>" +
        '<span class="status good">Clocked in</span></div>' +
        '<div class="mini"><div><span>Today</span><b data-tick-day="' + td + '">' + hm(dc.worked) + "</b></div><div><span>Normal day</span><b>" + hm(standardMin()) + "</b></div>" +
        "<div><span>Overtime</span><b>" + (dc.ot ? hm(dc.ot) : "—") + "</b></div></div>" +
        (type !== "normal" ? '<div class="banner warn">' + esc(holidayName(td) || DAY_LABEL[type]) + ": all hours today count as overtime.</div>" : "") +
        '<div class="btn-row"><button class="btn" data-act="att-switch">Switch warehouse</button><button class="btn bad" data-act="att-out">Clock out</button></div>';
    } else {
      h += '<div class="att-where">' + (dc.worked ? "Clocked out · worked " + hm(dc.worked) + " today" : "Not clocked in") + "</div></div>" +
        '<span class="status muted">Off</span></div><div class="sub" style="margin:0;font-size:13px">Tap where you are working to clock in:</div>' +
        '<div class="wh-grid">' + c.warehouses.map(function (w) {
          return '<button class="wh-btn" data-act="att-in" data-wh="' + esc(w.id) + '"><b>' + esc(w.name) + "</b><span>Clock in</span></button>";
        }).join("") + "</div>";
    }
    return h + '<a class="link" href="' + myHref("time") + '" style="text-align:left">My time and overtime →</a></div>';
  }

  function attIn(wh, btn) {
    btn.disabled = true;
    toast("Getting your location…");
    getLocation().then(function (loc) {
      return S.clockIn(wh, loc, today()).then(function () {
        toast("Clocked in at " + whName(wh) + (loc ? "" : " (no location: allow location for EZ Staff)"));
      });
    }).catch(function (e) { btn.disabled = false; toast(e.message); });
  }

  /** The nearest warehouse with a saved location, within its allowed distance. */
  function nearestWarehouse(loc) {
    if (!loc) return null;
    var best = null;
    tcfg().warehouses.forEach(function (w) {
      if (!w.lat) return;
      var d = distM(loc, w);
      if (d <= (Number(w.radius) || 300) && (!best || d < best.d)) best = { id: w.id, d: d };
    });
    return best ? best.id : null;
  }

  function attOut() {
    var open = openEntry(st.att, st.user.uid);
    if (!open) return;
    var chosen = open.warehouse, loc = null;
    var h = "<h2>Clock out</h2><p class=\"sub\" style=\"margin-top:-6px\">Clocked in at " + esc(whName(open.warehouse)) + " at " + clock(open.inAt) + " · " + hm((Date.now() - open.inAt) / 60000) + " so far.</p>" +
      '<div class="stack"><div class="eyebrow">Where are you now?</div><div class="wh-grid">' + tcfg().warehouses.map(function (w) {
        return '<button class="wh-btn' + (w.id === chosen ? " sel" : "") + '" data-out="' + esc(w.id) + '"><b>' + esc(w.name) + "</b><span>" + (w.id === open.warehouse ? "Same place" : "Finishing here") + "</span></button>";
      }).join("") + '</div><div class="hint" id="o-hint" style="font-size:12.5px;color:var(--muted)">Checking your location…</div>' +
      '<p class="sub" style="margin:0;font-size:12.5px">All your hours count for overtime, wherever you finish.</p>' +
      '<div class="btn-row"><button class="btn" data-close>Cancel</button><button class="btn bad" id="o-go">Clock out</button></div></div>';
    sheet(h, function (el, close) {
      function pick(id) {
        chosen = id;
        el.querySelectorAll("[data-out]").forEach(function (b) { b.classList.toggle("sel", b.getAttribute("data-out") === id); });
      }
      el.querySelectorAll("[data-out]").forEach(function (b) { b.onclick = function () { pick(b.getAttribute("data-out")); }; });
      getLocation().then(function (l) {
        loc = l;
        var near = nearestWarehouse(l), hint = el.querySelector("#o-hint");
        if (!hint) return;
        if (near) { pick(near); hint.textContent = "Your location shows you at " + whName(near) + "."; }
        else hint.textContent = l ? "Choose where you are now." : "No location: choose where you are now.";
      });
      el.querySelector("#o-go").onclick = function () {
        var btn = this;
        btn.disabled = true;
        (loc ? Promise.resolve(loc) : getLocation()).then(function (l) {
          return S.clockOut(open.id, l, chosen !== open.warehouse ? chosen : null).then(function () {
            close();
            toast("Clocked out" + (chosen !== open.warehouse ? " at " + whName(chosen) : ""));
            var copy = st.att.map(function (e) { return e.id === open.id ? Object.assign({}, e, { outAt: Date.now() }) : e; });
            syncOtDay(st.user.uid, open.date, copy);
          });
        }).catch(function (e) { btn.disabled = false; toast(e.message); });
      };
    });
  }

  function attSwitch() {
    var open = openEntry(st.att, st.user.uid);
    if (!open) return;
    sheet("<h2>Switch warehouse</h2><p class=\"sub\">Leaving " + esc(whName(open.warehouse)) + '. Where are you now?</p><div class="wh-grid">' +
      tcfg().warehouses.filter(function (w) { return w.id !== open.warehouse; }).map(function (w) {
        return '<button class="wh-btn" data-to="' + esc(w.id) + '"><b>' + esc(w.name) + "</b><span>Move here</span></button>";
      }).join("") + '</div><button class="btn block" data-close style="margin-top:12px">Cancel</button>', function (el, close) {
      el.querySelectorAll("[data-to]").forEach(function (b) {
        b.onclick = function () {
          var to = b.getAttribute("data-to");
          b.disabled = true;
          getLocation().then(function (loc) { return S.switchWarehouse(open.id, to, loc, today()); })
            .then(function () { close(); toast("Now at " + whName(to)); })
            .catch(function (e) { toast(e.message); });
        };
      });
    });
  }

  // ---- staff: my time ----

  function monthChips(base, m, keys) {
    return '<div class="chips" style="margin-bottom:14px">' + keys.map(function (k) {
      return '<a class="chip' + (k === m ? " on" : "") + '" href="' + base + k + '">' + esc(monthLabel(k)) + "</a>";
    }).join("") + "</div>";
  }
  function lastMonths(n) {
    var out = [], d = new Date();
    for (var i = 0; i < n; i++) { var x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(x.getFullYear() + "-" + ("0" + (x.getMonth() + 1)).slice(-2)); }
    return out;
  }
  function otChip(o) {
    if (!o) return "";
    if (o.status === "approved") return '<span class="status good">OT ' + hm(o.approvedMin) + " approved</span>";
    if (o.status === "rejected") return '<span class="status bad">OT rejected</span>';
    return '<span class="status warn">OT ' + hm(o.otMin) + " waiting</span>";
  }

  function viewMyTime(m) {
    if (LOCAL) return '<div class="card empty"><b>Time tracking needs the online app</b></div>';
    var keys = lastMonths(3);
    if (!m || keys.indexOf(m) < 0) m = keys[0];
    var entries = st.att.filter(function (e) { return monthOf(e.date) === m; });
    var days = {};
    entries.forEach(function (e) { (days[e.date] = days[e.date] || []).push(e); });
    var ots = st.ot.filter(function (o) { return monthOf(o.date) === m; });
    var worked = 0;
    Object.keys(days).forEach(function (d) { worked += dayCalc(days[d], st.user, d, false).worked; });
    var appr = sum(ots.filter(function (o) { return o.status === "approved"; }), function (o) { return o.approvedMin || 0; });
    var wait = sum(ots.filter(function (o) { return o.status === "pending"; }), function (o) { return o.otMin || 0; });
    var h = '<h1>My time</h1><p class="sub">' + esc(shiftLabel(shiftOf(st.user))) + " · overtime after " + hm(standardMin()) + " a day</p>" + monthChips(myHref("time") + "/", m, keys) +
      '<div class="kpis">' + kpi("Days worked", Object.keys(days).length, "", "") + kpi("Hours worked", hm(worked), "", "") +
      kpi("Overtime approved", hm(appr), "", "") + kpi("Overtime waiting", hm(wait), "", "", wait > 0) + "</div>";
    var list = Object.keys(days).sort().reverse();
    h += '<div class="section-title"><h2>Days</h2></div>';
    if (!list.length) return h + '<div class="card empty"><b>No time recorded this month</b>Clock in on the Home screen when you start work.</div>';
    h += '<div class="card flush">' + list.map(function (d) {
      var c = dayCalc(days[d], st.user, d, false), o = ots.filter(function (x) { return x.date === d; })[0];
      return '<div class="day-row"><div class="main"><b>' + esc(fmtDate(d)) + (c.type !== "normal" ? ' <span class="status info">' + esc(holidayName(d) || DAY_LABEL[c.type]) + "</span>" : "") + "</b>" +
        days[d].sort(function (a, b) { return a.inAt - b.inAt; }).map(function (e) {
          return "<span>" + esc(whName(e.warehouse)) + (e.outWarehouse ? " → " + esc(whName(e.outWarehouse)) : "") + " · " + clock(e.inAt) + "–" + (e.outAt ? clock(e.outAt) : "now") + (e.source === "supervisor" || e.editedBy ? " · by " + esc(e.editedBy || "supervisor") : "") + "</span>";
        }).join("") + '</div><div class="side"><b>' + hm(c.worked) + "</b>" + (o ? otChip(o) : c.ot ? '<span class="status muted">OT ' + hm(c.ot) + "</span>" : "") + "</div></div>";
    }).join("") + "</div>";
    return h;
  }

  // ---- office: time ----

  function staffList() {
    return st.users.filter(function (u) { return !u.pending && u.active !== false; }).sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
  }

  function viewTimeOffice(tab, m) {
    tab = tab || "now";
    var tabs = [["now", "Who's in"], ["ot", "Overtime to approve"], ["entries", "Time entries"], ["sites", "Warehouses"]];
    var h = '<div class="spread"><h1>Time</h1><button class="btn small primary" data-act="entry-add">+ Add entry</button></div><p class="sub">Live attendance from all warehouses · ' + esc(fmtDate(today())) + "</p>" +
      '<div class="chips" style="margin-bottom:14px">' + tabs.map(function (t) {
        var n = t[0] === "ot" ? st.allOt.filter(function (o) { return o.status === "pending" && o.ownerUid !== st.user.uid; }).length : 0;
        return '<a class="chip' + (tab === t[0] ? " on" : "") + '" href="#/time/' + t[0] + '">' + t[1] + (n ? '<span class="n">' + n + "</span>" : "") + "</a>";
      }).join("") + "</div>";
    if (tab === "now") return h + timeNow();
    if (tab === "ot") return h + timeOtQueue();
    if (tab === "entries") return h + timeEntries(m);
    return h + timeSites(m);
  }

  function timeNow() {
    var td = today(), c = tcfg(), h = '<div class="sites">';
    var open = st.allAtt.filter(function (e) { return !e.outAt; });
    c.warehouses.forEach(function (w) {
      var here = open.filter(function (e) { return e.warehouse === w.id; });
      h += '<div class="card site"><div class="spread"><h2>' + esc(w.name) + '</h2><span class="status ' + (here.length ? "good" : "muted") + '">' + plural(here.length, "person").replace("persons", "people") + "</span></div>" +
        (here.length ? here.map(function (e) {
          var ln = locNote(e.warehouse, e.inLoc);
          return '<div class="who"><div><b>' + esc(e.staffName) + "</b><span>since " + clock(e.inAt) + " · " + hm((Date.now() - e.inAt) / 60000) + (ln.warn ? ' · <em class="warnline">⚠ ' + esc(ln.text) + "</em>" : "") + "</span></div>" +
            (e.ownerUid !== st.user.uid ? '<button class="btn small" data-act="entry-edit" data-id="' + esc(e.id) + '">Edit</button>' : "") + "</div>";
        }).join("") : '<div class="sub" style="margin:6px 0 0;font-size:13px">Nobody clocked in</div>') + "</div>";
    });
    h += "</div>";
    var seen = {};
    st.allAtt.forEach(function (e) { if (e.date === td) seen[e.ownerUid] = 1; });
    var absent = staffList().filter(function (u) { return !seen[u.uid]; });
    h += '<div class="section-title"><h2>Not clocked in today</h2><span class="sub" style="margin:0">' + absent.length + "</span></div>";
    h += absent.length ? '<div class="card flush list">' + absent.map(function (u) {
      return '<div class="item"><span class="avatar">' + esc(initials(u.name)) + '</span><div class="main"><b>' + esc(u.name) + "</b><span>" + esc(shiftLabel(shiftOf(u))) + "</span></div>" +
        (u.uid !== st.user.uid ? '<button class="btn small" data-act="entry-add" data-uid="' + esc(u.uid) + '">Add time</button>' : "") + "</div>";
    }).join("") + "</div>" : '<div class="card empty"><b>Everyone has clocked in today</b></div>';
    return h;
  }

  function timeOtQueue() {
    var pend = st.allOt.filter(function (o) { return o.status === "pending" && o.ownerUid !== st.user.uid; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    var done = st.allOt.filter(function (o) { return o.status !== "pending"; }).sort(function (a, b) { return (b.decidedAt || 0) - (a.decidedAt || 0); }).slice(0, 15);
    var h = pend.length ? '<div class="card flush">' + pend.map(function (o) {
      return '<div class="day-row"><div class="main"><b>' + esc(o.staffName) + " · " + esc(fmtDate(o.date)) + (o.dayType !== "normal" ? ' <span class="status info">' + esc(holidayName(o.date) || DAY_LABEL[o.dayType]) + "</span>" : "") + "</b>" +
        "<span>Worked " + hm(o.workedMin) + (o.scheduledMin ? " · normal day " + hm(o.scheduledMin) : "") + " · " + esc(o.shift || "") + "</span>" + (o.note ? '<span class="warnline">' + esc(o.note) + "</span>" : "") +
        '<a class="link" href="#/time/entries/' + monthOf(o.date) + '" style="text-align:left;font-size:13px">See time entries</a></div>' +
        '<div class="side"><b>OT ' + hm(o.otMin) + '</b><div class="row"><button class="btn small good" data-act="ot-ok" data-id="' + esc(o.id) + '">Approve</button>' +
        '<button class="btn small" data-act="ot-change" data-id="' + esc(o.id) + '">Change</button><button class="btn small bad" data-act="ot-no" data-id="' + esc(o.id) + '">Reject</button></div></div></div>';
    }).join("") + "</div>" : '<div class="card empty"><b>No overtime waiting</b>Overtime appears here when staff clock out after their shift.</div>';
    if (done.length) {
      h += '<div class="section-title"><h2>Recently decided</h2></div><div class="card flush">' + done.map(function (o) {
        return '<div class="day-row"><div class="main"><b>' + esc(o.staffName) + " · " + esc(fmtDate(o.date)) + "</b><span>by " + esc(o.decidedBy || "") + (o.decisionNote ? " · " + esc(o.decisionNote) : "") + "</span></div>" +
          '<div class="side">' + otChip(o) + "</div></div>";
      }).join("") + "</div>";
    }
    return h;
  }

  function otDecide(id, kind) {
    var o = st.allOt.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    if (kind === "ok") {
      S.decideOt(id, { status: "approved", approvedMin: o.otMin, note: "" }).then(function () { toast("Overtime approved: " + hm(o.otMin)); }).catch(function (e) { toast(e.message); });
      return;
    }
    var change = kind === "change";
    sheet("<h2>" + (change ? "Change overtime" : "Reject overtime") + '</h2><p class="sub" style="margin-top:-6px">' + esc(o.staffName) + " · " + esc(fmtDate(o.date)) + " · asked " + hm(o.otMin) + '</p><div class="stack">' +
      (change ? '<div class="grid2"><div class="field"><label for="ot-h">Hours</label><input id="ot-h" type="number" min="0" max="24" inputmode="numeric" value="' + Math.floor(o.otMin / 60) + '"></div>' +
        '<div class="field"><label for="ot-m">Minutes</label><input id="ot-m" type="number" min="0" max="59" step="5" inputmode="numeric" value="' + (o.otMin % 60) + '"></div></div>' : "") +
      '<div class="field"><label for="ot-note">Reason' + (change ? " (optional)" : "") + '</label><input id="ot-note" placeholder="e.g. break not deducted"></div>' +
      '<div class="btn-row"><button class="btn" data-close>Cancel</button><button class="btn ' + (change ? "good" : "bad") + '" id="ot-go">' + (change ? "Approve this amount" : "Reject") + "</button></div></div>", function (el, close) {
      el.querySelector("#ot-go").onclick = function () {
        var note = el.querySelector("#ot-note").value.trim();
        if (!change && !note) { toast("Please write the reason."); return; }
        var f = change ? { status: "approved", approvedMin: (Number(el.querySelector("#ot-h").value) || 0) * 60 + (Number(el.querySelector("#ot-m").value) || 0), decisionNote: note }
          : { status: "rejected", approvedMin: 0, decisionNote: note };
        S.decideOt(id, f).then(function () { close(); toast(change ? "Overtime approved: " + hm(f.approvedMin) : "Overtime rejected"); }).catch(function (e) { toast(e.message); });
      };
    });
  }

  function timeEntries(m) {
    var keys = lastMonths(2);
    if (!m || keys.indexOf(m) < 0) m = keys[0];
    var who = st.office.timeStaff || "all";
    var list = st.allAtt.filter(function (e) { return monthOf(e.date) === m && (who === "all" || e.ownerUid === who); })
      .sort(function (a, b) { return b.inAt - a.inAt; });
    var h = monthChips("#/time/entries/", m, keys) + '<div class="spread" style="margin-bottom:10px"><select id="time-staff" aria-label="Staff"><option value="all">Everyone</option>' +
      staffList().map(function (u) { return '<option value="' + esc(u.uid) + '"' + (who === u.uid ? " selected" : "") + ">" + esc(u.name) + "</option>"; }).join("") +
      '</select><button class="btn small" data-act="att-csv" data-m="' + m + '">' + ICON.pdf + "Excel (CSV)</button></div>";
    if (!list.length) return h + '<div class="card empty"><b>No time entries</b></div>';
    return h + '<div class="card flush table-wrap"><table><thead><tr><th>Date</th><th>Staff</th><th>Warehouse</th><th>In</th><th>Out</th><th class="r">Hours</th><th>Check</th><th></th></tr></thead><tbody>' +
      list.map(function (e) {
        var li = locNote(e.warehouse, e.inLoc), flags = [];
        if (e.source === "supervisor") flags.push("Added by " + (e.editedBy || "supervisor"));
        else if (e.editedBy) flags.push("Edited by " + e.editedBy);
        if (li.warn) flags.push("In: " + li.text);
        if (e.outAt && e.source !== "supervisor") { var lo = locNote(e.outWarehouse || e.warehouse, e.outLoc); if (lo.warn) flags.push("Out: " + lo.text); }
        if (lateSync(e, "in") || lateSync(e, "out")) flags.push("Sent late (no signal?)");
        return "<tr><td>" + esc(fmtDate(e.date)) + "</td><td>" + esc(e.staffName) + "</td><td>" + esc(whName(e.warehouse)) + (e.outWarehouse ? " → " + esc(whName(e.outWarehouse)) : "") + "</td><td>" + clock(e.inAt) + "</td><td>" + (e.outAt ? clock(e.outAt) : '<span class="status good">in</span>') +
          '</td><td class="r">' + hm(((e.outAt || Date.now()) - e.inAt) / 60000) + '</td><td style="white-space:normal;font-size:12.5px;color:' + (flags.length ? "var(--warn)" : "var(--muted)") + '">' + esc(flags.join(" · ") || "OK") + "</td><td>" +
          (e.ownerUid !== st.user.uid ? '<button class="btn small" data-act="entry-edit" data-id="' + esc(e.id) + '">Edit</button>' : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function timeSites(m) {
    var keys = lastMonths(2);
    if (!m || keys.indexOf(m) < 0) m = keys[0];
    var c = tcfg(), list = st.allAtt.filter(function (e) { return monthOf(e.date) === m; });
    var by = {}, people = {};
    list.forEach(function (e) {
      var mins = ((e.outAt || Date.now()) - e.inAt) / 60000;
      by[e.warehouse] = (by[e.warehouse] || 0) + mins;
      (people[e.ownerUid] = people[e.ownerUid] || { name: e.staffName, w: {} }).w[e.warehouse] = (people[e.ownerUid].w[e.warehouse] || 0) + mins;
    });
    var h = monthChips("#/time/sites/", m, keys) + '<div class="kpis">' + c.warehouses.map(function (w) { return kpi(w.name, hm(by[w.id] || 0), "", "worked this month"); }).join("") + "</div>";
    var rows = Object.keys(people).map(function (k) { return people[k]; }).sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
    if (!rows.length) return h;
    return h + '<div class="section-title"><h2>Hours per person and warehouse</h2></div><div class="card flush table-wrap"><table><thead><tr><th>Staff</th>' +
      c.warehouses.map(function (w) { return '<th class="r">' + esc(w.name) + "</th>"; }).join("") + '<th class="r">Total</th></tr></thead><tbody>' +
      rows.map(function (p) {
        var tot = 0;
        return "<tr><td>" + esc(p.name) + "</td>" + c.warehouses.map(function (w) { tot += p.w[w.id] || 0; return '<td class="r">' + (p.w[w.id] ? hours(p.w[w.id]) : "—") + "</td>"; }).join("") + '<td class="r"><b>' + hours(tot) + "</b></td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /** Supervisor adds or corrects a time entry (never their own). */
  function entrySheet(id, uidPreset) {
    var e = id ? st.allAtt.filter(function (x) { return x.id === id; })[0] : null;
    var staff = staffList().filter(function (u) { return u.uid !== st.user.uid; });
    if (!staff.length) { toast("There is nobody else to add time for yet."); return; }
    var uid = e ? e.ownerUid : uidPreset || staff[0].uid, date = e ? e.date : today();
    var h = "<h2>" + (e ? "Edit time entry" : "Add time entry") + '</h2><div class="stack">' +
      '<div class="field"><label for="en-staff">Staff</label><select id="en-staff"' + (e ? " disabled" : "") + ">" + staff.map(function (u) {
        return '<option value="' + esc(u.uid) + '"' + (u.uid === uid ? " selected" : "") + ">" + esc(u.name) + "</option>";
      }).join("") + "</select></div>" +
      '<div class="grid2"><div class="field"><label for="en-date">Date</label><input id="en-date" type="date" value="' + date + '" max="' + today() + '"></div>' +
      '<div class="field"><label for="en-wh">Started at</label><select id="en-wh">' + tcfg().warehouses.map(function (w) {
        return '<option value="' + esc(w.id) + '"' + (e && e.warehouse === w.id ? " selected" : "") + ">" + esc(w.name) + "</option>";
      }).join("") + "</select></div></div>" +
      '<div class="field"><label for="en-owh">Finished at</label><select id="en-owh"><option value="">Same warehouse</option>' + tcfg().warehouses.map(function (w) {
        return '<option value="' + esc(w.id) + '"' + (e && e.outWarehouse === w.id ? " selected" : "") + ">" + esc(w.name) + "</option>";
      }).join("") + "</select></div>" +
      '<div class="grid2"><div class="field"><label for="en-in">Clock in</label><input id="en-in" type="time" value="' + (e ? clock(e.inAt) : shiftOf(userById(uid)).start) + '"></div>' +
      '<div class="field"><label for="en-out">Clock out</label><input id="en-out" type="time" value="' + (e && e.outAt ? clock(e.outAt) : e ? clock(Date.now()) : shiftOf(userById(uid)).end) + '"><span class="hint">Leave empty if still working.</span></div></div>' +
      '<div class="field"><label for="en-note">Note</label><input id="en-note" value="' + esc(e && e.note || "") + '" placeholder="e.g. forgot to clock out"></div>' +
      '<div class="btn-row">' + (e ? '<button class="btn bad" id="en-del">Delete</button>' : '<button class="btn" data-close>Cancel</button>') + '<button class="btn primary" id="en-save">Save</button></div></div>';
    sheet(h, function (el, close) {
      var del = el.querySelector("#en-del");
      if (del) del.onclick = function () {
        S.deleteAttendance(e.id).then(function () {
          close(); toast("Entry deleted");
          syncOtDay(e.ownerUid, e.date, st.allAtt.filter(function (x) { return x.id !== e.id; }));
        }).catch(function (x) { toast(x.message); });
      };
      el.querySelector("#en-save").onclick = function () {
        var u = userById(el.querySelector("#en-staff").value), d = el.querySelector("#en-date").value, tin = el.querySelector("#en-in").value, tout = el.querySelector("#en-out").value;
        if (!d || !tin) { toast("Enter the date and the clock-in time."); return; }
        var inAt = new Date(d + "T" + tin + ":00").getTime(), outAt = tout ? new Date(d + "T" + tout + ":00").getTime() : null;
        if (outAt && outAt <= inAt) outAt += 86400000; // past midnight
        if (outAt && outAt - inAt > 20 * 3600000) { toast("That is more than 20 hours. Check the times."); return; }
        var entry = e ? JSON.parse(JSON.stringify(e)) : { ownerUid: u.uid, staffName: u.name, inLoc: null, outLoc: null };
        entry.id = e ? e.id : undefined;
        if (e && e.inServer) entry.inServer = e.inServer; // keep Google's original timestamps
        if (e && e.outServer) entry.outServer = e.outServer;
        entry.date = d;
        entry.warehouse = el.querySelector("#en-wh").value;
        var owh = el.querySelector("#en-owh").value;
        if (owh && owh !== entry.warehouse) entry.outWarehouse = owh; else delete entry.outWarehouse;
        entry.inAt = inAt;
        entry.outAt = outAt;
        entry.note = el.querySelector("#en-note").value.trim();
        if (!e) delete entry.id;
        this.disabled = true;
        var btn = this;
        var data = {};
        for (var k in entry) if (k !== "inServer" && k !== "outServer") data[k] = entry[k];
        if (e) data.id = e.id;
        S.saveAttendance(data).then(function (newId) {
          close(); toast("Time saved");
          // the live list may already hold the new entry: count it once
          var all = st.allAtt.filter(function (x) { return x.id !== newId && x.id !== (e && e.id); }).concat([Object.assign({}, data, { id: newId })]);
          syncOtDay(u.uid, d, all);
          if (e && e.date !== d) syncOtDay(u.uid, e.date, all);
        }).catch(function (x) { btn.disabled = false; toast(x.message); });
      };
    });
  }

  function exportAttendanceCsv(m) {
    var rows = [["Date", "Staff", "Employee ID", "Warehouse (in)", "Warehouse (out)", "Clock in", "Clock out", "Hours", "In location", "Out location", "Source", "Edited by", "Note"]];
    st.allAtt.filter(function (e) { return monthOf(e.date) === m; }).sort(function (a, b) { return a.inAt - b.inAt; }).forEach(function (e) {
      var u = userById(e.ownerUid);
      rows.push([e.date, e.staffName, u.employeeId || "", whName(e.warehouse), whName(e.outWarehouse || e.warehouse), clock(e.inAt), e.outAt ? clock(e.outAt) : "", e.outAt ? hours((e.outAt - e.inAt) / 60000) : "",
        e.inLoc ? e.inLoc.lat + " " + e.inLoc.lng : "", e.outLoc ? e.outLoc.lat + " " + e.outLoc.lng : "", e.source, e.editedBy || "", e.note || ""]);
    });
    saveFile(new Blob(["﻿" + rows.map(csvLine).join("\r\n")], { type: "text/csv" }), "Attendance " + monthLabel(m) + ".csv");
  }

  // ---- payroll (manager and admin) ----

  function payrollRows(m) {
    var c = tcfg().ot;
    return staffList().map(function (u) {
      var pay = st.pay[u.uid] || {}, salary = Number(pay.salary) || 0, hourly = salary / c.daysPerMonth / c.hoursPerDay;
      var ots = st.allOt.filter(function (o) { return o.ownerUid === u.uid && monthOf(o.date) === m && o.status === "approved"; });
      var mins = { normal: 0, rest: 0, holiday: 0 };
      ots.forEach(function (o) { mins[o.dayType || "normal"] += o.approvedMin || 0; });
      var pend = sum(st.allOt.filter(function (o) { return o.ownerUid === u.uid && monthOf(o.date) === m && o.status === "pending"; }), function (o) { return o.otMin || 0; });
      var amount = (mins.normal / 60) * hourly * c.normal + (mins.rest / 60) * hourly * c.rest + (mins.holiday / 60) * hourly * c.holiday;
      amount = Math.round(amount * 1000) / 1000;
      return { uid: u.uid, name: u.name, employeeId: u.employeeId || "", shift: shiftOf(u).name, salary: salary, hourly: hourly, mins: mins, pending: pend,
        otAmount: amount, total: Math.round((salary + amount) * 1000) / 1000 };
    });
  }

  function viewPayroll(m) {
    if (!isAdmin()) return '<div class="card empty"><b>Admin only</b>Salaries and payroll are handled by the admin.</div>';
    var keys = lastMonths(3);
    if (!m || keys.indexOf(m) < 0) m = keys[0];
    var rows = payrollRows(m), c = tcfg().ot;
    var tot = { salary: sum(rows, function (r) { return r.salary; }), ot: sum(rows, function (r) { return r.otAmount; }), total: sum(rows, function (r) { return r.total; }) };
    var noSalary = rows.filter(function (r) { return !r.salary; }).length, pend = sum(rows, function (r) { return r.pending; });
    var h = '<h1>Payroll</h1><p class="sub">Salary + approved overtime · hourly wage = salary ÷ ' + c.daysPerMonth + " ÷ " + c.hoursPerDay + " · OT ×" + c.normal + ", Friday ×" + c.rest + ", holiday ×" + c.holiday + "</p>" +
      monthChips("#/payroll/", m, keys) +
      '<div class="kpis">' + kpi("Salaries", kd(tot.salary), "KD", plural(rows.length, "person").replace("persons", "people")) + kpi("Overtime", kd(tot.ot), "KD", "approved only") +
      kpi("Total to pay", kd(tot.total), "KD", "", true) + kpi("OT waiting", hm(pend), "", "not included yet", pend > 0) + "</div>";
    if (noSalary && isAdmin()) h += '<div class="banner warn" style="margin-top:12px">' + plural(noSalary, "person").replace("persons", "people") + " without a salary. Tap <b>Set salary</b> in the table.</div>";
    h += '<div class="btn-row" style="margin:14px 0"><button class="btn" data-act="pay-pdf" data-m="' + m + '">' + ICON.pdf + 'Payroll PDF</button><button class="btn" data-act="pay-csv" data-m="' + m + '">' + ICON.pdf + "Excel (CSV)</button></div>";
    h += '<div class="card flush table-wrap"><table><thead><tr><th>Staff</th><th>Shift</th><th class="r">Salary KD</th><th class="r">Hourly KD</th><th class="r">OT h</th><th class="r">Friday h</th><th class="r">Holiday h</th><th class="r">OT KD</th><th class="r">Total KD</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        return "<tr><td><b>" + esc(r.name) + "</b>" + (r.pending ? '<br><span class="warnline">' + hm(r.pending) + " OT waiting</span>" : "") + "</td><td>" + esc(r.shift) + '</td><td class="r">' + (r.salary ? kd(r.salary) : "—") + '</td><td class="r">' + (r.salary ? r.hourly.toFixed(3) : "—") +
          '</td><td class="r">' + hours(r.mins.normal) + '</td><td class="r">' + hours(r.mins.rest) + '</td><td class="r">' + hours(r.mins.holiday) + '</td><td class="r">' + kd(r.otAmount) + '</td><td class="r"><b>' + kd(r.total) + "</b></td><td>" +
          (isAdmin() ? '<button class="btn small" data-act="pay-set" data-uid="' + esc(r.uid) + '">Set salary</button>' : "") + "</td></tr>";
      }).join("") + '<tr class="tot"><td><b>Total</b></td><td></td><td class="r"><b>' + kd(tot.salary) + '</b></td><td></td><td class="r">' + hours(sum(rows, function (r) { return r.mins.normal; })) + '</td><td class="r">' + hours(sum(rows, function (r) { return r.mins.rest; })) +
      '</td><td class="r">' + hours(sum(rows, function (r) { return r.mins.holiday; })) + '</td><td class="r"><b>' + kd(tot.ot) + '</b></td><td class="r"><b>' + kd(tot.total) + "</b></td><td></td></tr></tbody></table></div>";
    return h;
  }

  function salarySheet(uid) {
    var u = userById(uid), cur = (st.pay[uid] || {}).salary || "";
    sheet("<h2>Salary · " + esc(u.name) + '</h2><div class="stack"><div class="field"><label for="sal">Monthly salary (KD)</label><input id="sal" type="number" min="0" step="0.001" inputmode="decimal" value="' + esc(cur) + '">' +
      '<span class="hint">Only the admin can see salaries.</span></div><div class="btn-row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="sal-go">Save</button></div></div>', function (el, close) {
      el.querySelector("#sal-go").onclick = function () {
        var v = parseFloat(el.querySelector("#sal").value);
        if (isNaN(v) || v < 0) { toast("Enter the salary in KD."); return; }
        S.setPay(uid, { salary: Math.round(v * 1000) / 1000, name: u.name }).then(function () { close(); toast("Salary saved"); }).catch(function (e) { toast(e.message); });
      };
    });
  }

  function exportPayrollCsv(m) {
    var c = tcfg().ot, rows = [["Month", "Staff", "Employee ID", "Shift", "Salary (KD)", "Hourly (KD)", "OT hours ×" + c.normal, "Friday hours ×" + c.rest, "Holiday hours ×" + c.holiday, "OT amount (KD)", "Total (KD)", "OT waiting (hours)"]];
    payrollRows(m).forEach(function (r) {
      rows.push([monthLabel(m), r.name, r.employeeId, r.shift, kd(r.salary), r.hourly.toFixed(3), hours(r.mins.normal), hours(r.mins.rest), hours(r.mins.holiday), kd(r.otAmount), kd(r.total), hours(r.pending)]);
    });
    saveFile(new Blob(["﻿" + rows.map(csvLine).join("\r\n")], { type: "text/csv" }), "Payroll " + monthLabel(m) + ".csv");
  }

  // ---- company settings (admin) ----

  function viewSettings() {
    if (!isAdmin()) return '<div class="card empty"><b>Admin only</b></div>';
    var c = tcfg();
    var h = '<h1>Company settings</h1><p class="sub">Warehouses, shifts, overtime rules and public holidays.</p><form id="settings-form" class="stack">' +
      '<div class="card stack"><div class="eyebrow">Warehouses</div><p class="sub" style="margin:0;font-size:13px">Stand at the warehouse and tap <b>Use my location here</b>. If someone clocks in or out further away than the <b>allowed distance</b>, the supervisor sees a warning (it doesn\'t block them). Use a bigger distance for large sites.</p>' +
      c.warehouses.map(function (w, i) {
        return '<div class="set-row" data-wh="' + i + '"><label class="mini-field">Warehouse<input aria-label="Warehouse name" data-k="name" value="' + esc(w.name) + '"></label>' +
          '<label class="mini-field">Allowed distance (metres)<input aria-label="Allowed distance in metres" data-k="radius" type="number" min="50" step="50" value="' + esc(w.radius || 300) + '"></label>' +
          '<button type="button" class="btn small" data-act="wh-here" data-i="' + i + '">' + (w.lat ? "📍 Set ✓" : "Use my location here") + "</button></div>";
      }).join("") + "</div>" +
      '<div class="card stack"><div class="eyebrow">Shifts</div>' + c.shifts.map(function (sh, i) {
        return '<div class="set-row" data-sh="' + i + '"><input aria-label="Shift name" data-k="name" value="' + esc(sh.name) + '"><input aria-label="Start" type="time" data-k="start" value="' + esc(sh.start) + '"><input aria-label="End" type="time" data-k="end" value="' + esc(sh.end) + '">' +
          (c.shifts.length > 1 ? '<button type="button" class="btn small bad" data-act="sh-del" data-i="' + i + '">Remove</button>' : "") + "</div>";
      }).join("") + '<button type="button" class="btn small" data-act="sh-add">+ Add shift</button><p class="sub" style="margin:0;font-size:12.5px">The shift shows when each person is expected to start. Choose it on the People page.</p></div>' +
      '<div class="card stack"><div class="eyebrow">Overtime rules (Kuwait Labour Law)</div><div class="grid3">' +
      [["standardHours", "Normal hours per day (OT after)"], ["daysPerMonth", "Days per month (wage)"], ["hoursPerDay", "Hours per day (wage)"], ["roundMin", "Count OT in blocks of (min)"], ["normal", "Normal day ×"], ["rest", "Rest day ×"], ["holiday", "Public holiday ×"]].map(function (f) {
        return '<div class="field"><label for="ot-' + f[0] + '">' + f[1] + '</label><input id="ot-' + f[0] + '" data-ot="' + f[0] + '" type="number" step="0.01" min="0" value="' + c.ot[f[0]] + '"></div>';
      }).join("") + '</div><div class="field"><label for="ot-restDay">Weekly rest day</label><select id="ot-restDay" data-ot="restDay">' +
      ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(function (d, i) { return '<option value="' + i + '"' + (Number(c.ot.restDay) === i ? " selected" : "") + ">" + d + "</option>"; }).join("") + "</select></div>" +
      '<p class="sub" style="margin:0;font-size:12.5px">Overtime = hours worked in a day beyond the normal hours, wherever the person worked. On the rest day and public holidays every hour worked is overtime. Hourly wage = salary ÷ days per month ÷ hours per day.</p></div>' +
      '<div class="card stack"><div class="eyebrow">Public holidays</div>' + (c.holidays.length ? c.holidays.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).map(function (x) {
        return '<div class="spread"><span><b>' + esc(fmtDate(x.date)) + "</b> · " + esc(x.name) + '</span><button type="button" class="link" data-act="hol-del" data-d="' + esc(x.date) + '">Remove</button></div>';
      }).join("") : '<span class="sub" style="margin:0">None yet</span>') +
      '<div class="set-row"><input id="hol-date" type="date" aria-label="Holiday date"><input id="hol-name" placeholder="e.g. National Day" aria-label="Holiday name"><button type="button" class="btn small" data-act="hol-add">Add</button></div></div>' +
      '<div class="sticky-actions"><a class="btn" href="#/users">Back</a><button class="btn primary" type="submit">Save settings</button></div></form>';
    return h;
  }

  /** Reads the settings form into a settings object (keeping warehouse locations). */
  function readSettings() {
    var c = JSON.parse(JSON.stringify(tcfg())), f = document.getElementById("settings-form");
    if (!f) return c;
    f.querySelectorAll("[data-wh]").forEach(function (row) {
      var w = c.warehouses[Number(row.getAttribute("data-wh"))];
      w.name = row.querySelector('[data-k="name"]').value.trim() || w.name;
      w.radius = Number(row.querySelector('[data-k="radius"]').value) || 300;
    });
    f.querySelectorAll("[data-sh]").forEach(function (row) {
      var sh = c.shifts[Number(row.getAttribute("data-sh"))];
      sh.name = row.querySelector('[data-k="name"]').value.trim() || sh.name;
      sh.start = row.querySelector('[data-k="start"]').value || sh.start;
      sh.end = row.querySelector('[data-k="end"]').value || sh.end;
    });
    f.querySelectorAll("[data-ot]").forEach(function (i) { c.ot[i.getAttribute("data-ot")] = Number(i.value); });
    return c;
  }
  function saveSettingsNow(c, msg) {
    st.settings = c;
    return S.saveSettings(c).then(function () { toast(msg || "Settings saved"); route(); }).catch(function (e) { toast(e.message); });
  }

  // ------------------------------------------------------------------ router

  function route() {
    renderTop();
    renderNav();
    if (!st.ready) {
      $main.innerHTML = '<div class="spinner" aria-label="Loading"></div>';
      return;
    }
    if (!st.user) {
      document.getElementById("demo").hidden = true;
      $main.innerHTML = LOCAL ? viewSetup() : viewLogin();
      return;
    }
    document.getElementById("demo").hidden = true;
    if (st.user.active === false) {
      $main.innerHTML = st.user.pending
        ? '<div class="login"><div class="box card stack" style="text-align:center"><img src="img/logo.png" alt="EZ Storage" style="width:150px;margin:0 auto">' +
          '<h1>Waiting for approval</h1><p class="sub" style="margin:0">Your account (' + esc(st.user.email || "") + ') was created. The admin needs to allow it before you can add fuel bills. This page opens by itself once you are allowed.</p>' +
          '<button class="btn" data-act="signout">Sign out</button></div></div>'
        : '<div class="card empty"><b>Your account is turned off</b>Ask the admin to turn it back on.<div style="margin-top:14px"><button class="btn" data-act="signout">Sign out</button></div></div>';
      return;
    }
    var parts = (location.hash || "#/home").slice(2).split("/");
    var page = parts[0] || "home", id = parts[1];
    var html;
    draftPad = null;
    switch (page) {
      case "claims": html = viewClaims(); break;
      case "claim": html = viewClaim(id, false); break;
      case "review": html = viewClaim(id, true); break;
      case "bills": html = viewBills(); break;
      case "add": html = viewBills(); break;
      case "mine": html = viewHomeLocal(); break;
      case "time": html = isOffice() ? viewTimeOffice(id, parts[2]) : viewMyTime(id); break;
      case "my-time": html = viewMyTime(id); break;
      case "payroll": html = viewPayroll(id); break;
      case "settings": html = viewSettings(); break;
      case "my-claims": html = viewClaims(); break;
      case "my-reports": html = viewReports(id); break;
      case "all-bills": html = viewAllBills(id); break;
      case "make-claim": html = viewMakeClaim(); break;
      case "reports": html = isOffice() ? viewOfficeReports(id, parts[2]) : viewReports(id); break;
      case "new":
        if (true) { html = viewBills(); page = "add"; break; }
        if (!st.draft) startDraft(null);
        html = viewForm();
        break;
      case "edit":
        if (!st.draft || st.draft.id !== id) {
          if (!startDraft(id)) { html = '<div class="card empty"><b>Claim not found</b></div>'; break; }
        }
        html = viewForm();
        break;
      case "office": html = viewOffice(); break;
      case "users": html = viewUsers(); break;
      case "profile": html = viewProfile(); break;
      default: html = viewHome();
    }
    $main.innerHTML = html;
    var sig = document.getElementById("d-sig");
    if (sig) draftPad = signaturePad(sig);
    loadThumbs();
    if (page === "add") {
      history.replaceState(null, "", "#/bills");
      renderNav();
      billSheet(null);
    }
  }

  // ------------------------------------------------------------------ events

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el) return;
    var a = el.getAttribute("data-act");
    switch (a) {
      case "demo-login": S.signInDemo(el.getAttribute("data-uid")); break;
      case "login-tab": st.loginTab = el.getAttribute("data-tab"); route(); break;
      case "forgot":
        var em = document.getElementById("f-email").value.trim();
        if (!em) { toast("Type your email first, then tap Forgot password."); break; }
        S.resetPassword(em).then(function () { toast("Password reset email sent to " + em); }).catch(function (x) { toast(x.message); });
        break;
      case "signout": S.signOut(); location.hash = "#/home"; break;
      case "reset-demo": S.resetDemo(); toast("Demo data reset"); break;
      case "theme": localStorage.setItem("ezfuel-theme", el.getAttribute("data-v")); applyTheme(); route(); break;
      case "filter-status": st.filter.status = el.getAttribute("data-v"); route(); break;
      case "office-tab": st.officeTab = el.getAttribute("data-v"); route(); break;
      case "csv": exportCsv(); break;
      case "pdf":
      case "share":
        var c = findClaim(el.getAttribute("data-id"));
        el.disabled = true;
        makePdf(c).then(function (blob) {
          el.disabled = false;
          return a === "pdf" ? saveFile(blob, pdfName(c)) : shareFile(blob, pdfName(c), c.claimNo);
        }).catch(function (x) { el.disabled = false; toast("Couldn't make the PDF: " + x.message); });
        break;
      case "do": doAction(el.getAttribute("data-id"), el.getAttribute("data-a")); break;
      case "mark-paid": if (LOCAL || canApprove()) markPaid(el.getAttribute("data-id")); break;
      case "approve": if (canApprove()) approveSheet(el.getAttribute("data-id")); break;
      case "allow-user":
        S.setUser(el.getAttribute("data-uid"), { active: true, pending: false, allowedAt: Date.now(), allowedBy: st.user.name })
          .then(function () { toast("Account allowed"); }).catch(function (x) { toast(x.message); });
        break;
      case "office-driver": st.office.driver = el.getAttribute("data-v"); route(); break;
      case "bills-csv": exportBillsCsv(); break;
      case "claims-csv": exportClaimsCsv(); break;
      case "upload-local": uploadLocal(el); break;
      case "skip-upload": S.skipUpload(); route(); break;
      case "add-bill": billSheet(null); break;
      case "att-in": attIn(el.getAttribute("data-wh"), el); break;
      case "att-out": attOut(); break;
      case "att-switch": attSwitch(); break;
      case "entry-add": entrySheet(null, el.getAttribute("data-uid")); break;
      case "entry-edit": entrySheet(el.getAttribute("data-id")); break;
      case "ot-ok": otDecide(el.getAttribute("data-id"), "ok"); break;
      case "ot-change": otDecide(el.getAttribute("data-id"), "change"); break;
      case "ot-no": otDecide(el.getAttribute("data-id"), "no"); break;
      case "att-csv": exportAttendanceCsv(el.getAttribute("data-m")); break;
      case "pay-csv": exportPayrollCsv(el.getAttribute("data-m")); break;
      case "pay-set": salarySheet(el.getAttribute("data-uid")); break;
      case "pay-pdf":
        var pm = el.getAttribute("data-m");
        try {
          saveFile(P.buildPayroll({ month: pm, label: monthLabel(pm), rows: payrollRows(pm), ot: tcfg().ot, by: st.user.name }, C).output("blob"), "Payroll " + monthLabel(pm) + ".pdf");
        } catch (x) { toast("Couldn't make the PDF: " + x.message); }
        break;
      case "wh-here":
        var wi = Number(el.getAttribute("data-i")), sc = readSettings();
        el.disabled = true;
        el.textContent = "Getting location…";
        getLocation().then(function (loc) {
          if (!loc) { el.disabled = false; el.textContent = "Use my location here"; toast("Couldn't get the location. Allow location for this app and try again."); return; }
          sc.warehouses[wi].lat = loc.lat;
          sc.warehouses[wi].lng = loc.lng;
          saveSettingsNow(sc, sc.warehouses[wi].name + " location saved (±" + loc.acc + " m)");
        });
        break;
      case "sh-add": var sa = readSettings(); sa.shifts.push({ id: "s" + Date.now().toString(36), name: "New shift", start: "07:00", end: "16:00" }); st.settings = sa; route(); break;
      case "sh-del": var sd = readSettings(); sd.shifts.splice(Number(el.getAttribute("data-i")), 1); st.settings = sd; route(); break;
      case "hol-add":
        var hd = document.getElementById("hol-date").value, hn = document.getElementById("hol-name").value.trim();
        if (!hd || !hn) { toast("Enter the holiday date and name."); break; }
        var ha = readSettings(); ha.holidays = ha.holidays.filter(function (x) { return x.date !== hd; }).concat([{ date: hd, name: hn }]); st.settings = ha; route();
        break;
      case "hol-del": var hr = readSettings(), dd = el.getAttribute("data-d"); hr.holidays = hr.holidays.filter(function (x) { return x.date !== dd; }); st.settings = hr; route(); break;
      case "open-bill": billSheet(el.getAttribute("data-id")); break;
      case "create-claim": createClaim(); break;
      case "change-sig": signatureSheet(); break;
      case "report-pdf":
      case "report-share":
        var rm = el.getAttribute("data-m"), ruid = el.getAttribute("data-driver") || "";
        var rwho = ruid ? (st.users.filter(function (u) { return u.uid === ruid; })[0] || {}).name || "" : st.user.name || "";
        var rname = "Fuel report " + monthLabel(rm) + " " + rwho.replace(/[^\w\- ]+/g, "").trim() + ".pdf";
        el.disabled = true;
        makeReportPdf(rm, ruid).then(function (blob) {
          el.disabled = false;
          return a === "report-pdf" ? saveFile(blob, rname) : shareFile(blob, rname, "Fuel report " + monthLabel(rm));
        }).catch(function (x) { el.disabled = false; toast("Couldn't make the PDF: " + x.message); });
        break;
      case "reopen":
        S.act(findClaim(el.getAttribute("data-id")), "reopen", {}).then(function () { toast("Marked as not paid"); });
        break;
      case "view-photo":
        var pid = el.getAttribute("data-photo");
        if (!pid) break;
        getPhoto(el.getAttribute("data-claim") || (st.draft && st.draft.id), pid).then(function (src) {
          if (!src) return;
          var v = document.createElement("div");
          v.className = "viewer";
          v.innerHTML = '<img alt="Receipt photo"><button>Close</button>';
          v.querySelector("img").src = src;
          v.onclick = function () { v.remove(); };
          document.body.appendChild(v);
        });
        break;
      case "delete-claim":
        var dc = findClaim(el.getAttribute("data-id"));
        sheet("<h2>Delete this claim?</h2><p class=\"sub\">" + esc(dc.claimNo) + " will be deleted. " + "Its bills go back to the bills list." + "</p><div class=\"btn-row\"><button class=\"btn\" data-close>Keep it</button><button class=\"btn bad\" id=\"del-go\">Delete</button></div>", function (s, close) {
          s.querySelector("#del-go").onclick = function () { S.deleteClaim(dc.id).then(function () { close(); toast("Claim deleted"); go("#/claims"); }); };
        });
        break;
      // form
      case "step":
        var to = Number(el.getAttribute("data-to"));
        if (st.step === 1) { readStep1(); if (to > 1 && !checkStep1()) break; }
        if (st.step === 3 && draftPad && !draftPad.isEmpty()) st.draft.driverSignature = draftPad.toDataURL();
        if (st.step === 3) st.draft.declaration = document.getElementById("decl").checked;
        if (to === 3 && !st.draft.receipts.length) { toast("Add at least one receipt first."); break; }
        st.step = to;
        route();
        window.scrollTo(0, 0);
        break;
      case "save-draft":
        if (st.step === 1) readStep1();
        persistDraft(false);
        break;
      case "add-receipt":
        if (st.draft.receipts.length >= C.maxReceipts) { toast("A claim can have up to " + C.maxReceipts + " receipts. Start a new claim for the rest."); break; }
        receiptSheet(-1);
        break;
      case "edit-receipt": receiptSheet(Number(el.getAttribute("data-i"))); break;
      case "sig-clear": if (draftPad) draftPad.clear(); break;
      case "resign": st.draft.driverSignature = ""; route(); break;
      case "submit-claim": submitDraft(); break;
      case "toggle-active":
        var uid = el.getAttribute("data-uid"), uu = st.users.filter(function (x) { return x.uid === uid; })[0];
        S.setUser(uid, { active: uu.active === false, pending: false }).then(function () { toast(uu.active === false ? "Account re-activated" : "Account turned off"); }).catch(function (x) { toast(x.message); });
        break;
    }
  });

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-role")) {
      S.setUser(t.getAttribute("data-role"), { role: t.value }).then(function () { toast("Role changed to " + (S.ROLE_LABELS[t.value] || t.value)); }).catch(function (x) { toast(x.message); });
    } else if (t.hasAttribute("data-shift")) {
      S.setUser(t.getAttribute("data-shift"), { shiftId: t.value }).then(function () { toast("Shift changed"); }).catch(function (x) { toast(x.message); });
    } else if (t.id === "time-staff") {
      st.office.timeStaff = t.value;
      route();
    } else if (t.hasAttribute("data-filter") && t.tagName === "SELECT") {
      st.filter[t.getAttribute("data-filter")] = t.value;
      route();
    }
  });

  var searchTimer;
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.getAttribute("data-filter") === "q") {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        st.filter.q = t.value;
        route();
        var s = document.getElementById("of-q");
        if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
      }, 300);
    }
  });

  document.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    if (f.id === "settings-form") {
      saveSettingsNow(readSettings());
      return;
    }
    if (f.id === "setup-form") {
      var sv = {};
      new FormData(f).forEach(function (val, k) { sv[k] = String(val).trim(); });
      var miss = ["name", "employeeId", "department", "vehicle"].filter(function (k) { return !sv[k]; });
      f.querySelectorAll(".field").forEach(function (x) { x.classList.toggle("err", miss.indexOf(x.getAttribute("data-f")) >= 0); });
      if (miss.length) {
        var sm = document.getElementById("setup-msg");
        sm.hidden = false;
        sm.textContent = "Please fill in all four details.";
        return;
      }
      S.createProfile(sv);
      location.hash = "#/home";
      return;
    }
    if (f.id === "auth-form") {
      var v = {};
      new FormData(f).forEach(function (val, k) { v[k] = String(val).trim(); });
      var msg = document.getElementById("auth-msg");
      msg.hidden = true;
      var btn = f.querySelector("button[type=submit]");
      if (st.loginTab === "up" && (!v.name || !v.employeeId)) { msg.hidden = false; msg.textContent = "Please enter your full name and employee ID."; return; }
      btn.disabled = true;
      (st.loginTab === "up" ? S.signUp(v) : S.signIn(v.email, v.password)).catch(function (x) {
        btn.disabled = false;
        msg.hidden = false;
        msg.textContent = x.message;
      });
    } else if (f.id === "profile-form") {
      var p = {};
      new FormData(f).forEach(function (val, k) { p[k] = String(val).trim(); });
      S.updateProfile(p).then(function () { toast("Profile saved"); }).catch(function (x) { toast(x.message); });
    }
  });

  window.addEventListener("hashchange", function () {
    var page = (location.hash || "").slice(2).split("/")[0];
    if (page !== "new" && page !== "edit") st.draft = null;
    if (page !== "claim") st.justFinished = null;
    route();
  });

  // ------------------------------------------------------------------ start

  function subscribe() {
    st.unsub.forEach(function (u) { try { u(); } catch (e) {} });
    st.unsub = [];
    st.mine = [];
    st.bills = [];
    st.allBills = [];
    st.att = [];
    st.allAtt = [];
    st.ot = [];
    st.allOt = [];
    st.pay = {};
    st.all = [];
    st.users = [];
    if (!st.user) return;
    if (st.user.active === false) return; // waiting to be allowed
    st.unsub.push(S.watchClaims("mine", function (list) { st.mine = list; refresh(); }));
    st.unsub.push(S.watchBills(function (list) { st.bills = list; refresh(); }));
    if (!LOCAL) {
      st.unsub.push(S.watchSettings(function (x) { st.settings = x; refresh(); }));
      st.unsub.push(S.watchAttendance("mine", null, function (list) { st.att = list; refresh(); }));
      st.unsub.push(S.watchOt("mine", function (list) { st.ot = list; refresh(); }));
    }
    if (isOffice()) {
      var from = new Date(); from = new Date(from.getFullYear(), from.getMonth() - 1, 1);
      st.unsub.push(S.watchAttendance("all", dateOf(from.getTime()), function (list) { st.allAtt = list; refresh(); }));
      st.unsub.push(S.watchOt("all", function (list) { st.allOt = list; refresh(); }));
      if (isAdmin()) st.unsub.push(S.watchPay(function (m) { st.pay = m; refresh(); }));
      st.unsub.push(S.watchBills(function (list) { st.allBills = list; refresh(); }, "all"));
      st.unsub.push(S.watchClaims("all", function (list, err) { st.all = list; st.allError = err ? err.message : null; refresh(); }));
      st.unsub.push(S.watchUsers(function (list) { st.users = list; refresh(); }));
    }
  }

  var refreshTimer;
  function refresh() {
    // don't redraw while the person is filling in the claim form or a dialog is open
    var page = (location.hash || "").slice(2).split("/")[0];
    if (page === "new" || page === "edit" || page === "make-claim" || page === "settings" || document.querySelector(".scrim")) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(route, 60);
  }

  setInterval(function () {
    var page = (location.hash || "#/home").slice(2).split("/")[0] || "home";
    if (st.user && ["home", "mine", "time", "my-time"].indexOf(page) >= 0 && (openEntry(st.att, st.user.uid) || st.allAtt.some(function (e) { return !e.outAt; }))) refresh();
  }, 60000);

  function start() {
    $main = document.getElementById("main");
    $nav = document.getElementById("nav");
    applyTheme();
    route();
    S.init().then(function () {
      S.onAuth(function (user) {
        var roleChanged = !st.user || !user || st.user.uid !== user.uid || st.user.role !== user.role || st.user.active !== user.active;
        st.user = user;
        st.ready = true;
        if (roleChanged) subscribe();
        route();
      });
    }).catch(function (e) {
      $main.innerHTML = '<div class="card empty"><b>The app couldn\'t start</b>' + esc(e.message) + "</div>";
    });
    if ("serviceWorker" in navigator && location.protocol === "https:" && !window.EZAndroid) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
