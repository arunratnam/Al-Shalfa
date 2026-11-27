/* EZ Storage Fuel Expense app: screens and behaviour. */
(function () {
  "use strict";

  var S = window.EZStore, C = window.EZ_CONFIG, P = window.EZPdf;
  var LOCAL = S.mode === "local"; // one driver per phone, no server
  var $main, $nav;
  var st = {
    user: null, ready: false, mine: [], all: [], users: [], allError: null,
    unsub: [], filter: { status: "all", month: "all", driver: "all", q: "" }, officeTab: "queue",
    draft: null, step: 1, photoCache: {}, loginTab: "in", bills: []
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
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }
  function isStaff() { return S.isStaff(st.user); }
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

  function anchorSave(blob, filename) {
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
    if (LOCAL) {
      items = [["home", "Home", ICON.home], ["bills", "Bills", ICON.fuel], ["add", "Add bill", '<span class="plus">' + ICON.plus + "</span>"],
        ["claims", "Claims", ICON.list], ["reports", "Monthly", ICON.office]];
    } else {
      items = [["home", "Home", ICON.home], ["claims", "My claims", ICON.list], ["new", "New claim", '<span class="plus">' + ICON.plus + "</span>"]];
      if (isStaff()) items.push(["office", "Office", ICON.office]);
      if (st.user.role === "admin") items.push(["users", "Staff", ICON.users]);
      items.push(["profile", "Profile", ICON.user]);
    }
    $nav.innerHTML = items.map(function (it) {
      var on = r === it[0] || (it[0] === "claims" && r === "claim") || (it[0] === "office" && r === "review");
      if (it[0] === "claims" && r === "make-claim") on = true;
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
      '<div class="title"><b>Fuel Expenses</b><span>' + esc(st.user.name) + " · " + esc(LOCAL ? st.user.vehicle : S.ROLE_LABELS[st.user.role] || "") + "</span></div>" +
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

  function claimItem(c, staffView) {
    var who = staffView ? esc(c.driverName) + " · " : "";
    var t = c.totals || { count: 0, amount: 0 };
    return '<a class="item" href="#/' + (staffView ? "review" : "claim") + "/" + esc(c.id) + '"><div class="main"><b>' + who + esc(c.claimNo || "Draft claim") + "</b><span>" +
      esc(fmtDate(c.periodFrom)) + " – " + esc(fmtDate(c.periodTo)) + " · " + plural(t.count, LOCAL ? "bill" : "receipt") +
      (c.sample ? " · Example" : "") + '</span></div><div class="side"><span class="amt">' + kd(amountOf(c)) + ' KD</span>' + statusChip(c.status) + "</div></a>";
  }

  function viewHome() {
    if (LOCAL) return viewHomeLocal();
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
    var waiting = mine.filter(function (c) { return c.status === "submitted"; });
    var paidMonth = mine.filter(function (c) { return c.status === "paid" && c.paidAt && monthOf(new Date(c.paidAt).toISOString()) === month; });
    var all = billsWithMileage(), open = all.filter(function (b) { return !b.claimId; });
    var thisMonth = all.filter(function (b) { return monthOf(b.date) === month; });
    var first = (st.user.name || "").split(" ")[0];
    var n = open.length, need = CLAIM_SIZE;
    var cur = open.slice(0, need), m = mileageOf(cur);
    var curAmount = sum(cur, function (b) { return Number(b.amount) || 0; }), curLitres = sum(cur, function (b) { return Number(b.litres) || 0; });
    var last = mine.filter(function (c) { return c.status !== "draft"; }).sort(function (x, y) { return (y.submittedAt || 0) - (x.submittedAt || 0); })[0];
    var h = "<h1>Hello, " + esc(first) + '</h1><p class="sub">' + now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) + "</p>";

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
    h += '<div class="section-title"><h2>My claims</h2><a href="#/claims">See all</a></div><div class="kpis">' +
      kpi("Waiting for payment", kd(sum(waiting)), "KD", plural(waiting.length, "claim"), waiting.length > 0) +
      kpi("Paid this month", kd(sum(paidMonth, paidAmt)), "KD", plural(paidMonth.length, "claim")) + "</div>";
    if (last) {
      h += '<div class="card flush list" style="margin-top:10px">' + claimItem(last) + "</div>";
    }

    // the whole month, claimed and new bills together
    h += '<div class="section-title"><h2>This month · all bills</h2><a href="#/reports/' + month + '">Monthly report</a></div><div class="kpis">' +
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
    if (LOCAL) return viewClaimLocal(id);
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
    var eff = efficiency(c.receipts || []);
    var h = '<div class="spread" style="margin-bottom:4px"><h1>' + esc(c.claimNo || "Draft claim") + "</h1>" + statusChip(c.status) + "</div>" +
      '<p class="sub">' + esc(fmtDate(c.periodFrom)) + " – " + esc(fmtDate(c.periodTo)) + " · " + esc(c.vehicle || "") + "</p>";
    if (st.justFinished === c.id) {
      h += '<div class="banner good" style="margin-bottom:14px"><b>Claim finished ✓</b> Now send the PDF to the office on WhatsApp.</div>';
    } else if (c.status === "submitted") {
      h += '<div class="banner info" style="margin-bottom:14px">Send the PDF to the office. When the money arrives, tap <b>Mark as paid</b>.</div>';
    } else if (c.status === "paid") {
      h += '<div class="banner good" style="margin-bottom:14px"><b>Paid ' + kd(paidAmt(c)) + " KD</b> on " + esc(fmtDate(new Date(c.paidAt).toISOString())) + (c.paidRef ? " · Ref. " + esc(c.paidRef) : "") + "</div>";
    }
    var acts = [];
    if (c.status === "draft") {
      acts.push('<a class="btn primary" href="#/edit/' + esc(c.id) + '">Continue claim</a>');
    } else {
      acts.push('<button class="btn primary" data-act="share" data-id="' + esc(c.id) + '">' + (canShare() ? ICON.whatsapp + "Share on WhatsApp" : ICON.share + "Share PDF") + "</button>");
      acts.push('<button class="btn" data-act="pdf" data-id="' + esc(c.id) + '">' + ICON.pdf + "Download PDF</button>");
      if (c.status === "submitted") {
        acts.push('<button class="btn good" data-act="mark-paid" data-id="' + esc(c.id) + '">Mark as paid</button>');

      } else if (c.status === "paid") {
        acts.push('<button class="btn" data-act="reopen" data-id="' + esc(c.id) + '">Not paid yet</button>');
      }
    }
    h += '<div class="btn-row" style="margin-bottom:6px">' + acts.join("") + "</div>";
    h += '<div class="section-title"><h2>Details</h2></div><div class="card"><div class="kv">' +
      kvp("Driver", c.driverName) + kvp("Employee ID", c.employeeId) + kvp("Department", c.department) + kvp("Vehicle number", c.vehicle) +
      kvp("Period", fmtDate(c.periodFrom) + " – " + fmtDate(c.periodTo)) + kvp("Submission date", c.status === "draft" ? "Not finished" : fmtDate(c.submissionDate)) +
      (c.status === "paid" ? kvp("Amount paid", kd(paidAmt(c)) + " KD") : "") + "</div></div>";
    var cm = claimMileage(c);
    if (cm) h += '<div class="section-title"><h2>Mileage</h2></div>' + mileageCard(cm).replace('style="margin-top:10px"', "");
    h += '<div class="section-title"><h2>Fuel receipts</h2></div>' + receiptsBlock(c, false) + '<div style="height:10px"></div>' + totalsBar(c);
    if (c.driverSignature) {
      h += '<div class="section-title"><h2>Your signature</h2></div><div class="card"><img class="sig-img" alt="Driver signature" src="' + esc(c.driverSignature) + '"></div>';
    }
    if (c.status !== "paid") {
      h += '<div style="margin-top:22px"><button class="btn bad block" data-act="delete-claim" data-id="' + esc(c.id) + '">Delete claim</button><p class="sub" style="font-size:12.5px;margin-top:6px">Deleting the claim puts its bills back in your list.</p></div>';
    }
    return h;
  }

  function markPaid(id) {
    var c = findClaim(id);
    if (!c) return;
    var h = '<h2>Mark as paid</h2><p class="sub" style="margin-top:-6px">' + esc(c.claimNo) + " · " + kd(c.totals.amount) + ' KD claimed</p><div class="stack">' +
      '<div class="grid2"><div class="field"><label for="p-amount">Amount received (KD)</label><input id="p-amount" type="number" step="0.001" min="0" inputmode="decimal" value="' + kd(c.totals.amount) + '"></div>' +
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
    if (st.user.role !== "admin") return '<div class="card empty"><b>Administrators only</b></div>';
    var users = st.users.slice().sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
    var h = '<h1>Staff & roles</h1><p class="sub">Drivers submit claims. Verifiers check receipts. Approvers approve and mark paid. Administrators can do everything.</p><div class="card flush list">';
    h += users.map(function (u) {
      return '<div class="item"><span class="avatar">' + esc(initials(u.name)) + '</span><div class="main"><b>' + esc(u.name) + (u.uid === st.user.uid ? " (you)" : "") + "</b><span>" + esc(u.email || "") + " · " + esc(u.employeeId || "no ID") + " · " + esc(u.department || "") + "</span></div>" +
        '<div class="side"><select aria-label="Role for ' + esc(u.name) + '" data-role="' + esc(u.uid) + '"' + (u.uid === st.user.uid ? " disabled" : "") + ">" +
        S.ROLES.map(function (r) { return '<option value="' + r + '"' + (u.role === r ? " selected" : "") + ">" + S.ROLE_LABELS[r] + "</option>"; }).join("") + "</select>" +
        (u.uid === st.user.uid ? "" : '<button class="link" data-act="toggle-active" data-uid="' + esc(u.uid) + '">' + (u.active === false ? "Re-activate" : "Deactivate") + "</button>") + "</div></div>";
    }).join("");
    return h + "</div>";
  }

  // ------------------------------------------------------------------ profile

  function viewProfile() {
    var u = st.user;
    var h = '<h1>Profile</h1><p class="sub">' + (LOCAL ? "These details go on every claim form." : esc(u.email || "") + " · " + esc(S.ROLE_LABELS[u.role])) + "</p>" +
      '<form id="profile-form" class="card stack">' + field("name", "Full name", "text", u.name, "required") +
      '<div class="grid2">' + field("employeeId", "Employee ID", "text", u.employeeId || "", "") + selectField("department", "Department", C.departments, u.department || "") + "</div>" +
      field("vehicle", "Vehicle number", "text", u.vehicle || "", 'placeholder="e.g. KWT 12-34567"') +
      '<button class="btn primary" type="submit">Save profile</button></form>' +
      (LOCAL ? '<div class="section-title"><h2>Signature</h2></div><div class="card spread">' +
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
  function billsWithMileage() {
    var prev = null;
    return st.bills.slice().sort(billOrder).map(function (b) {
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
    var c = st.mine.filter(function (x) { return x.id === id; })[0];
    return c ? c.claimNo : "";
  }

  function billRow(b) {
    var mil = [];
    if (b.distance) mil.push("+" + b.distance.toLocaleString() + " km");
    if (b.kmpl) mil.push(b.kmpl.toFixed(1) + " km/L");
    return '<button class="receipt bill" data-act="open-bill" data-id="' + esc(b.id) + '"><span class="thumb" data-thumb="' + esc(b.photoId || "") + '" data-claim="">' + (b.photoId ? "" : "No photo") + "</span>" +
      '<span class="main"><b>' + esc(b.station || "—") + "</b><span>" + esc(fmtDate(b.date)) + " · " + (b.odometer ? Number(b.odometer).toLocaleString() + " km" : "") + "</span>" +
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
      h += '<div class="section-title"><h2>' + esc(monthLabel(m)) + '</h2><a href="#/reports/' + m + '">Report</a></div>' +
        '<p class="sub" style="margin:-4px 0 8px;font-size:13px">' + plural(list.length, "bill") + " · " + sum(list, function (b) { return b.distance || 0; }).toLocaleString() + " km · " +
        lit(sum(list, function (b) { return Number(b.litres) || 0; })) + " L · " + kd(sum(list, function (b) { return Number(b.amount) || 0; })) + " KD</p>" +
        '<div class="card flush">' + list.slice().reverse().map(billRow).join("") + "</div>";
    });
    return h;
  }

  function billSheet(id) {
    var all = billsWithMileage();
    var b = id ? all.filter(function (x) { return x.id === id; })[0] : null;
    if (id && !b) return;
    var locked = !!(b && b.claimId);
    var r = b ? { id: b.id, date: b.date, station: b.station, odometer: b.odometer, litres: b.litres, amount: b.amount, photoId: b.photoId, createdAt: b.createdAt, claimId: b.claimId }
      : { date: today(), station: "", odometer: "", litres: "", amount: "", photoId: "" };
    var stations = {};
    all.forEach(function (x) { if (x.station) stations[x.station] = 1; });
    var newPhoto = null;
    var dis = locked ? " disabled" : "";
    var h = "<h2>" + (b ? (locked ? "Fuel bill" : "Edit fuel bill") : "Add fuel bill") + "</h2>" +
      (locked ? '<div class="banner info" style="margin-bottom:12px">This bill is in claim ' + esc(claimNoOf(b.claimId)) + ", so it can't be changed.</div>" : "") +
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
      return S.createClaim(open.map(function (b) { return b.id; }), { signature: sig, mileage: mileageOf(open) });
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

  function monthReport(m) {
    var all = billsWithMileage(), list = all.filter(function (b) { return monthOf(b.date) === m; });
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
    var claims = st.mine.filter(function (c) { return monthOf(c.submissionDate) === m || list.some(function (b) { return b.claimId === c.id; }); });
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
      '<div class="chips" style="margin-bottom:14px">' + keys.map(function (k) { return '<a class="chip' + (k === m ? " on" : "") + '" href="#/reports/' + k + '">' + esc(monthLabel(k)) + "</a>"; }).join("") + "</div>" +
      '<div class="kpis">' + kpi("Distance driven", t.km.toLocaleString(), "km", plural(t.count, "bill")) + kpi("Fuel cost", kd(t.amount), "KD", lit(t.litres) + " litres") +
      kpi("Average", t.kmpl ? t.kmpl.toFixed(1) : "—", "km/L", t.ppl ? t.ppl.toFixed(3) + " KD per litre" : "") +
      kpi("Claimed", t.claimed + " / " + t.count, "", plural(rep.claims.length, "claim")) + "</div>" +
      '<div class="card stack" style="margin-top:14px"><label class="check"><input type="checkbox" id="rep-photos" checked><span>Include the bill photos in the PDF</span></label>' +
      '<div class="btn-row"><button class="btn primary" data-act="report-share" data-m="' + m + '">' + (canShare() ? ICON.whatsapp + "Share on WhatsApp" : ICON.share + "Share PDF") + "</button>" +
      '<button class="btn" data-act="report-pdf" data-m="' + m + '">' + ICON.pdf + "Download PDF</button></div></div>" +
      '<div class="section-title"><h2>Bills in ' + esc(rep.label) + '</h2></div><div class="card flush">' + rep.bills.slice().reverse().map(billRow).join("") + "</div>";
    return h;
  }

  function makeReportPdf(m) {
    var rep = monthReport(m), withPhotos = document.getElementById("rep-photos") ? document.getElementById("rep-photos").checked : true;
    toast("Preparing PDF…");
    return Promise.all(rep.bills.map(function (b) { return withPhotos ? getPhoto(null, b.photoId) : null; })).then(function (photos) {
      rep.bills.forEach(function (b) { b.claimNo = b.claimId ? claimNoOf(b.claimId) : ""; });
      return P.buildMonthly(rep, photos, st.user, C, S.STATUS).output("blob");
    });
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
      $main.innerHTML = '<div class="card empty"><b>Your account is turned off</b>Ask an administrator to re-activate it.<div style="margin-top:14px"><button class="btn" data-act="signout">Sign out</button></div></div>';
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
      case "add": html = LOCAL ? viewBills() : viewHome(); break;
      case "make-claim": html = viewMakeClaim(); break;
      case "reports": html = viewReports(id); break;
      case "new":
        if (LOCAL) { html = viewBills(); page = "add"; break; }
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
      case "mark-paid": markPaid(el.getAttribute("data-id")); break;
      case "add-bill": billSheet(null); break;
      case "open-bill": billSheet(el.getAttribute("data-id")); break;
      case "create-claim": createClaim(); break;
      case "change-sig": signatureSheet(); break;
      case "report-pdf":
      case "report-share":
        var rm = el.getAttribute("data-m"), rname = "Fuel report " + monthLabel(rm) + " " + (st.user.name || "").replace(/[^\w\- ]+/g, "").trim() + ".pdf";
        el.disabled = true;
        makeReportPdf(rm).then(function (blob) {
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
        sheet("<h2>Delete this claim?</h2><p class=\"sub\">" + esc(dc.claimNo) + " will be deleted. " + (LOCAL ? "Its bills go back to your bills list." : "") + "</p><div class=\"btn-row\"><button class=\"btn\" data-close>Keep it</button><button class=\"btn bad\" id=\"del-go\">Delete</button></div>", function (s, close) {
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
        S.setUser(uid, { active: uu.active === false }).then(function () { toast(uu.active === false ? "Account re-activated" : "Account turned off"); }).catch(function (x) { toast(x.message); });
        break;
    }
  });

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-role")) {
      S.setUser(t.getAttribute("data-role"), { role: t.value }).then(function () { toast("Role updated"); }).catch(function (x) { toast(x.message); });
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
    st.all = [];
    st.users = [];
    if (!st.user) return;
    st.unsub.push(S.watchClaims("mine", function (list) { st.mine = list; refresh(); }));
    if (LOCAL) st.unsub.push(S.watchBills(function (list) { st.bills = list; refresh(); }));
    if (isStaff()) {
      st.unsub.push(S.watchClaims("all", function (list, err) { st.all = list; st.allError = err ? err.message : null; refresh(); }));
    }
    if (st.user.role === "admin") st.unsub.push(S.watchUsers(function (list) { st.users = list; refresh(); }));
  }

  var refreshTimer;
  function refresh() {
    // don't redraw while the person is filling in the claim form or a dialog is open
    var page = (location.hash || "").slice(2).split("/")[0];
    if (page === "new" || page === "edit" || page === "make-claim" || document.querySelector(".scrim")) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(route, 60);
  }

  function start() {
    $main = document.getElementById("main");
    $nav = document.getElementById("nav");
    applyTheme();
    route();
    S.init().then(function () {
      S.onAuth(function (user) {
        var roleChanged = !st.user || !user || st.user.uid !== user.uid || st.user.role !== user.role;
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
