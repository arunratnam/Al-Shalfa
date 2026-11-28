/*
 * Builds the claim PDF in the layout of the paper form EZ-OPS-FUEL-002,
 * followed by the receipt photos in the same order as the table.
 */
(function () {
  "use strict";

  var RED = [200, 16, 46], INK = [25, 25, 25], LINE = [125, 125, 125], FILL = [234, 234, 234], MUTED = [95, 95, 95];
  var M = 14, W = 182; // page margin and content width (mm)

  function d(iso) {
    if (!iso) return "";
    var p = String(iso).slice(0, 10).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
  }

  function dt(ms) {
    return ms ? d(new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString()) : "";
  }

  function kd(n) {
    return n === undefined || n === null || n === "" || isNaN(n) ? "" : Number(n).toFixed(3);
  }

  function num(n, dec) {
    return n === undefined || n === null || n === "" || isNaN(n) ? "" : Number(n).toFixed(dec);
  }

  /** Writes text that fits its box: shrinks a little, then cuts with "…". */
  function fit(doc, text, x, y, maxW, size, opts) {
    text = String(text || "");
    var s = size;
    doc.setFontSize(s);
    while (doc.getTextWidth(text) > maxW && s > size - 2) {
      s -= 0.5;
      doc.setFontSize(s);
    }
    if (doc.getTextWidth(text) > maxW) {
      while (text.length > 1 && doc.getTextWidth(text + "…") > maxW) text = text.slice(0, -1);
      text += "…";
    }
    doc.text(text, x, y, opts || {});
    doc.setFontSize(size);
  }

  function section(doc, title, y) {
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(11.5);
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.text(title, M, y);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFont("helvetica", "normal");
  }

  function cell(doc, x, y, w, h, fill) {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.25);
    if (fill) {
      doc.setFillColor(FILL[0], FILL[1], FILL[2]);
      doc.rect(x, y, w, h, "FD");
    } else {
      doc.rect(x, y, w, h);
    }
  }

  /** A row of label/value pairs: cols = [[label, value, labelW, valueW], ...] */
  function pairRow(doc, y, h, cols) {
    var x = M;
    cols.forEach(function (c) {
      cell(doc, x, y, c[2], h, true);
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.text(c[0], x + 2, y + h / 2 + 1.2);
      x += c[2];
      cell(doc, x, y, c[3], h, false);
      if (c[1] && typeof c[1] === "object" && c[1].image) {
        try {
          var props = doc.getImageProperties(c[1].image);
          var ih = h - 2, iw = Math.min(c[3] - 4, ih * props.width / props.height);
          ih = iw * props.height / props.width;
          doc.addImage(c[1].image, "PNG", x + 2, y + (h - ih) / 2, iw, ih);
        } catch (e) {}
      } else {
        doc.setFont("helvetica", "bold");
        fit(doc, c[1], x + 2, y + h / 2 + 1.2, c[3] - 4, 9.5);
        doc.setFont("helvetica", "normal");
      }
      x += c[3];
    });
  }

  var COLS = [
    ["No.", 12], ["Fuel Date", 24], ["Fuel Station", 50], ["Odometer (KM)", 26], ["Litres", 20], ["Amount (KD)", 26], ["Receipt", 24]
  ];

  function receiptHeader(doc, y) {
    var x = M;
    COLS.forEach(function (c) {
      cell(doc, x, y, c[1], 8, true);
      doc.setFontSize(9);
      doc.text(c[0], x + c[1] / 2, y + 5.2, { align: "center" });
      x += c[1];
    });
    return y + 8;
  }

  function receiptRow(doc, y, i, r) {
    var h = 7, x = M;
    var vals = r ? [String(i + 1), d(r.date), r.station, num(r.odometer, 0), num(r.litres, 2), kd(r.amount), ""] : [String(i + 1), "", "", "", "", "", ""];
    COLS.forEach(function (c, k) {
      cell(doc, x, y, c[1], h, false);
      doc.setFontSize(9);
      if (k === 6) {
        // receipt box: filled when a photo is attached
        doc.setDrawColor(INK[0], INK[1], INK[2]);
        doc.setFillColor(INK[0], INK[1], INK[2]);
        if (r && r.photoId) doc.rect(x + c[1] / 2 - 1.6, y + 1.9, 3.2, 3.2, "F");
        else doc.rect(x + c[1] / 2 - 1.6, y + 1.9, 3.2, 3.2);
      } else if (vals[k]) {
        if (k === 2) fit(doc, vals[k], x + 2, y + 4.8, c[1] - 4, 9);
        else fit(doc, vals[k], x + c[1] / 2, y + 4.8, c[1] - 3, 9, { align: "center" });
      }
      x += c[1];
    });
    return y + h;
  }

  function stamp(doc, claim, labels) {
    var s = labels[claim.status] || { label: claim.status };
    var colors = { approved: [21, 128, 61], paid: [21, 128, 61], rejected: [185, 28, 28], returned: [180, 83, 9] };
    var c = colors[claim.status] || [55, 65, 81];
    var text = s.label.toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    var w = doc.getTextWidth(text) + 8;
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.setTextColor(c[0], c[1], c[2]);
    doc.setLineWidth(0.6);
    doc.roundedRect(M + W - w, 12, w, 9, 1.5, 1.5);
    doc.text(text, M + W - w / 2, 18, { align: "center" });
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    if (claim.status === "paid" && claim.paidAt) doc.text("on " + dt(claim.paidAt), M + W - w / 2, 24.5, { align: "center" });
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setLineWidth(0.25);
  }

  function footer(doc, claim) {
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text((claim.claimNo || "") + "  ·  Generated " + dt(Date.now()) + " " + new Date().toTimeString().slice(0, 5), M, 290);
      doc.text("Page " + i + " of " + n, M + W, 290, { align: "right" });
      doc.setTextColor(INK[0], INK[1], INK[2]);
    }
  }

  /**
   * claim: claim object; photos: array of data URLs (same order as claim.receipts, null when none)
   * cfg: EZ_CONFIG; labels: status labels. Returns a jsPDF document.
   */
  function build(claim, photos, cfg, labels) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    doc.setProperties({ title: (cfg.formTitle || "Fuel Expense Submission Form") + " " + (claim.claimNo || ""), author: cfg.companyName || "" });
    var receipts = claim.receipts || [];
    var t = window.EZStore.totals(receipts);

    // ---- header ----
    if (window.EZ_LOGO) {
      try {
        doc.addImage(window.EZ_LOGO, "PNG", 105 - 25, 9, 50, 50 * 134 / 308);
      } catch (e) {}
    }
    if (["approved", "paid", "returned", "rejected"].indexOf(claim.status) >= 0) stamp(doc, claim, labels);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.text((cfg.formTitle || "Fuel Expense Submission Form").toUpperCase(), 105, 38, { align: "center" });
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text("Document No.: " + cfg.docNo + " | Version: " + cfg.docVersion, M, 44.5);
    doc.setFont("helvetica", "bold");
    doc.text("Claim No.: " + (claim.claimNo || "—"), M + W, 44.5, { align: "right" });
    doc.setFont("helvetica", "normal");

    // ---- A ----
    var y = 51.5;
    section(doc, "A. DRIVER & SUBMISSION DETAILS", y);
    y += 2;
    pairRow(doc, y, 8, [["Driver Name", claim.driverName, 34, 62], ["Employee ID", claim.employeeId, 34, 52]]);
    y += 8;
    pairRow(doc, y, 8, [["Vehicle Number", claim.vehicle, 34, 62], ["Department", claim.department, 34, 52]]);
    y += 8;
    pairRow(doc, y, 8, [["Submission Period", "From: " + d(claim.periodFrom) + "   To: " + d(claim.periodTo), 34, 62],
      ["Submission Date", d(claim.submissionDate), 34, 52]]);
    y += 8;

    // ---- B ----
    y += 7;
    section(doc, "B. FUEL RECEIPT DETAILS", y);
    y = receiptHeader(doc, y + 2);
    for (var i = 0; i < 10; i++) y = receiptRow(doc, y, i, receipts[i]);
    if (receipts.length > 10) {
      doc.setFontSize(8);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text("Receipts 11–" + receipts.length + " continue on the next page.", M, y + 3.5);
      doc.setTextColor(INK[0], INK[1], INK[2]);
    }

    // ---- C ----
    y += 7;
    section(doc, "C. SUBMISSION SUMMARY", y);
    y += 2;
    pairRow(doc, y, 8, [["Number of Receipts", String(t.count), 42, 54], ["Total Litres", num(t.litres, 2), 42, 44]]);
    y += 8;
    var approved = claim.amountApproved !== undefined && claim.amountApproved !== null && claim.amountApproved !== "" ? kd(claim.amountApproved) + " KD" : "";
    pairRow(doc, y, 8, [["Total Amount Submitted", kd(t.amount) + " KD", 42, 54], ["Amount Approved", approved, 42, 44]]);
    y += 8;
    var mi = claim.mileage;
    if (mi && mi.km) {
      pairRow(doc, y, 8, [["Distance Driven", Number(mi.km).toLocaleString("en-US") + " km (" + Number(mi.startOdo).toLocaleString("en-US") + " – " + Number(mi.endOdo).toLocaleString("en-US") + ")", 42, 54],
        ["Average Mileage", (mi.kmpl ? mi.kmpl.toFixed(1) + " km/L" : "—") + (mi.ppl ? "  ·  " + mi.ppl.toFixed(3) + " KD/L" : ""), 42, 44]]);
      y += 8;
    }

    // ---- D ----
    y += 7;
    section(doc, "D. DRIVER DECLARATION", y);
    doc.setFontSize(9.5);
    var decl = doc.splitTextToSize("I confirm that all fuel receipts listed above relate to the company vehicle and that the information provided is correct. All original receipts are attached.", W);
    doc.text(decl, M, y + 5);
    y += 5 + decl.length * 4.2 + 3;
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(10.5);
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.text("Driver Sign-off", M, y);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFont("helvetica", "normal");
    y += 2;
    pairRow(doc, y, 13, [["Driver Signature", claim.driverSignature ? { image: claim.driverSignature } : "", 34, 62],
      ["Date", claim.submittedAt ? dt(claim.submittedAt) : "", 34, 52]]);
    y += 13;

    // ---- E ----
    y += 7;
    section(doc, "E. COMPANY VERIFICATION & APPROVAL", y);
    y += 2;
    pairRow(doc, y, 8, [["Verified By", claim.verifiedBy || "", 34, 62], ["Date", claim.verifiedAt ? dt(claim.verifiedAt) : "", 34, 52]]);
    y += 8;
    pairRow(doc, y, 8, [["Approved By", claim.approvedBy || "", 34, 62], ["Date", claim.approvedAt ? dt(claim.approvedAt) : "", 34, 52]]);
    y += 8;
    var remarks = claim.remarks || "";
    if (claim.status === "paid" && claim.paidRef) remarks = (remarks ? remarks + " · " : "") + "Paid, ref. " + claim.paidRef;
    pairRow(doc, y, 14, [["Signature / Stamp", claim.approverSignature ? { image: claim.approverSignature } : "", 34, 62], ["Remarks", "", 34, 52]]);
    if (remarks) {
      doc.setFontSize(8.5);
      var rl = doc.splitTextToSize(remarks, 48).slice(0, 3);
      doc.text(rl, M + 34 + 62 + 34 + 2, y + 4.5);
    }
    y += 14;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("Company Use Only – Attach all original fuel receipts in the same order as listed above.", 105, y + 6, { align: "center" });
    doc.setFont("helvetica", "normal");

    // ---- receipts 11+ ----
    if (receipts.length > 10) {
      for (var start = 10; start < receipts.length; start += 30) {
        doc.addPage();
        section(doc, "B. FUEL RECEIPT DETAILS (continued)", 18);
        var yy = receiptHeader(doc, 20);
        for (var j = start; j < Math.min(receipts.length, start + 30); j++) yy = receiptRow(doc, yy, j, receipts[j]);
      }
    }

    // ---- photos, two per page ----
    var withPhotos = [];
    receipts.forEach(function (r, k) {
      if (photos && photos[k]) withPhotos.push({ r: r, k: k, img: photos[k] });
    });
    for (var p = 0; p < withPhotos.length; p++) {
      if (p % 2 === 0) {
        doc.addPage();
        section(doc, "ATTACHED FUEL RECEIPTS  ·  " + (claim.claimNo || ""), 16);
      }
      var slotY = p % 2 === 0 ? 22 : 156, slotH = 128;
      var item = withPhotos[p];
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.text("Receipt " + (item.k + 1), M, slotY + 4);
      doc.setFont("helvetica", "normal");
      doc.text([d(item.r.date), item.r.station || "", kd(item.r.amount) + " KD", num(item.r.litres, 2) + " L"].join("   ·   "), M + 22, slotY + 4);
      try {
        var props = doc.getImageProperties(item.img);
        var maxW = W, maxH = slotH - 10;
        var s = Math.min(maxW / props.width, maxH / props.height);
        var iw = props.width * s, ih = props.height * s;
        doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
        doc.addImage(item.img, "JPEG", M + (W - iw) / 2, slotY + 7, iw, ih);
        doc.rect(M + (W - iw) / 2, slotY + 7, iw, ih);
      } catch (e) {
        doc.text("(photo could not be added)", M, slotY + 14);
      }
    }

    footer(doc, claim);
    return doc;
  }

  // ------------------------------------------------------------------ monthly report

  /** Draws a table with a header row, repeating the header on new pages. cols = [[title, width, align]] */
  function table(doc, y, cols, rows, opts) {
    opts = opts || {};
    var rh = 7;
    function head() {
      var x = M;
      cols.forEach(function (c) {
        cell(doc, x, y, c[1], 8, true);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text(c[0], x + c[1] / 2, y + 5.2, { align: "center" });
        doc.setFont("helvetica", "normal");
        x += c[1];
      });
      y += 8;
    }
    head();
    rows.forEach(function (r, ri) {
      if (y + rh > 280) {
        doc.addPage();
        y = 16;
        head();
      }
      var x = M, bold = opts.boldLast && ri === rows.length - 1;
      cols.forEach(function (c, k) {
        if (bold) {
          doc.setFillColor(FILL[0], FILL[1], FILL[2]);
          doc.rect(x, y, c[1], rh, "FD");
        } else {
          cell(doc, x, y, c[1], rh, false);
        }
        doc.setFont("helvetica", bold ? "bold" : "normal");
        var v = r[k] === undefined || r[k] === null ? "" : String(r[k]);
        if (v) {
          if (c[2] === "left") fit(doc, v, x + 2, y + 4.8, c[1] - 4, 8.5);
          else if (c[2] === "right") fit(doc, v, x + c[1] - 2, y + 4.8, c[1] - 4, 8.5, { align: "right" });
          else fit(doc, v, x + c[1] / 2, y + 4.8, c[1] - 3, 8.5, { align: "center" });
        }
        x += c[1];
      });
      doc.setFont("helvetica", "normal");
      y += rh;
    });
    return y;
  }

  /**
   * rep: { month, label, bills: [{date, station, odometer, distance, litres, amount, kmpl, claimNo}], totals, claims }
   * photos: data URLs in the same order as rep.bills (or nulls). profile: the driver.
   */
  function buildMonthly(rep, photos, profile, cfg, labels) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    var t = rep.totals;
    doc.setProperties({ title: "Monthly fuel report " + rep.label + " " + (profile.name || ""), author: cfg.companyName || "" });

    if (window.EZ_LOGO) {
      try { doc.addImage(window.EZ_LOGO, "PNG", 105 - 25, 9, 50, 50 * 134 / 308); } catch (e) {}
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.text("MONTHLY FUEL REPORT", 105, 38, { align: "center" });
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFontSize(11);
    doc.text(rep.label.toUpperCase(), 105, 44, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Fuel bills summary · reference form " + cfg.docNo, 105, 49, { align: "center" });
    doc.setTextColor(INK[0], INK[1], INK[2]);

    var y = 57;
    section(doc, "A. DRIVER DETAILS", y);
    y += 2;
    pairRow(doc, y, 8, [["Driver Name", profile.name, 34, 62], ["Employee ID", profile.employeeId, 34, 52]]);
    y += 8;
    pairRow(doc, y, 8, [["Vehicle Number", profile.vehicle, 34, 62], ["Department", profile.department, 34, 52]]);
    y += 8;

    y += 7;
    section(doc, "B. MONTH SUMMARY", y);
    y += 2;
    pairRow(doc, y, 8, [["Number of Bills", String(t.count), 42, 54], ["Distance Driven", t.km.toLocaleString("en-US") + " km", 42, 44]]);
    y += 8;
    pairRow(doc, y, 8, [["Total Litres", num(t.litres, 2), 42, 54], ["Total Amount", kd(t.amount) + " KD", 42, 44]]);
    y += 8;
    pairRow(doc, y, 8, [["Average Fuel Economy", t.kmpl ? t.kmpl.toFixed(1) + " km/L" : "—", 42, 54], ["Average Price", t.ppl ? t.ppl.toFixed(3) + " KD/L" : "—", 42, 44]]);
    y += 8;

    y += 7;
    section(doc, "C. FUEL BILLS", y);
    y += 2;
    var cols = [["No.", 8], ["Date", 19], ["Fuel Station", 33, "left"], ["Odometer", 19], ["Distance km", 19], ["Litres", 15], ["Amount KD", 18], ["km/L", 12], ["Claim No.", 39]];
    var rows = rep.bills.map(function (b, i) {
      return [i + 1, d(b.date), b.station, num(b.odometer, 0), b.distance ? String(b.distance) : "—", num(b.litres, 2), kd(b.amount), b.kmpl ? b.kmpl.toFixed(1) : "—", b.claimNo || "Not claimed"];
    });
    rows.push(["", "", "Total", "", t.km ? String(t.km) : "", num(t.litres, 2), kd(t.amount), t.kmpl ? t.kmpl.toFixed(1) : "", t.claimed + "/" + t.count + " claimed"]);
    y = table(doc, y, cols, rows, { boldLast: true });

    if (rep.claims.length) {
      if (y + 30 > 280) { doc.addPage(); y = 16; } else { y += 9; }
      section(doc, "D. CLAIMS", y);
      y += 2;
      y = table(doc, y, [["Claim No.", 46, "left"], ["Period", 46], ["Bills", 16], ["Amount KD", 24], ["Status", 22], ["Paid On", 28]],
        rep.claims.map(function (c) {
          return [c.claimNo, d(c.periodFrom) + " – " + d(c.periodTo), c.totals ? c.totals.count : "", kd(c.totals ? c.totals.amount : 0),
            (labels[c.status] || { label: c.status }).label, c.paidAt ? dt(c.paidAt) : ""];
        }));
    }

    // bill photos, two per page
    var withPhotos = [];
    rep.bills.forEach(function (b, k) { if (photos && photos[k]) withPhotos.push({ r: b, k: k, img: photos[k] }); });
    for (var p = 0; p < withPhotos.length; p++) {
      if (p % 2 === 0) {
        doc.addPage();
        section(doc, "FUEL BILL PHOTOS  ·  " + rep.label.toUpperCase(), 16);
      }
      var slotY = p % 2 === 0 ? 22 : 156, item = withPhotos[p];
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.text("Bill " + (item.k + 1), M, slotY + 4);
      doc.setFont("helvetica", "normal");
      doc.text([d(item.r.date), item.r.station || "", kd(item.r.amount) + " KD", num(item.r.odometer, 0) + " km"].join("   ·   "), M + 18, slotY + 4);
      try {
        var props = doc.getImageProperties(item.img);
        var sc = Math.min(W / props.width, 118 / props.height), iw = props.width * sc, ih = props.height * sc;
        doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
        doc.addImage(item.img, "JPEG", M + (W - iw) / 2, slotY + 7, iw, ih);
        doc.rect(M + (W - iw) / 2, slotY + 7, iw, ih);
      } catch (e) {
        doc.text("(photo could not be added)", M, slotY + 14);
      }
    }

    footer(doc, { claimNo: "Monthly fuel report " + rep.label + " · " + (profile.name || "") });
    return doc;
  }

  // ------------------------------------------------------------------ payroll

  /** data: { month, label, rows: payrollRows(), ot: rules, by: name } */
  function buildPayroll(data, cfg) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    var o = data.ot;
    doc.setProperties({ title: "Payroll " + data.label, author: cfg.companyName || "" });
    if (window.EZ_LOGO) {
      try { doc.addImage(window.EZ_LOGO, "PNG", 105 - 22, 9, 44, 44 * 134 / 308); } catch (e) {}
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.text("MONTHLY PAYROLL – SALARY & OVERTIME", 105, 34, { align: "center" });
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFontSize(11);
    doc.text(data.label.toUpperCase(), 105, 40, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Hourly wage = salary ÷ " + o.daysPerMonth + " ÷ " + o.hoursPerDay + "   ·   Overtime ×" + o.normal + ", rest day ×" + o.rest + ", public holiday ×" + o.holiday +
      "   ·   approved overtime only", 105, 45.5, { align: "center" });
    doc.setTextColor(INK[0], INK[1], INK[2]);

    var y = 52;
    section(doc, "STAFF", y);
    y += 2;
    var rows = data.rows.map(function (r, i) {
      return [i + 1, r.name, r.employeeId, r.shift, kd(r.salary), r.salary ? r.hourly.toFixed(3) : "", (r.mins.normal / 60).toFixed(2), (r.mins.rest / 60).toFixed(2),
        (r.mins.holiday / 60).toFixed(2), kd(r.otAmount), kd(r.total)];
    });
    var t = function (f) { return data.rows.reduce(function (a, r) { return a + f(r); }, 0); };
    rows.push(["", "Total", "", "", kd(t(function (r) { return r.salary; })), "", (t(function (r) { return r.mins.normal; }) / 60).toFixed(2), (t(function (r) { return r.mins.rest; }) / 60).toFixed(2),
      (t(function (r) { return r.mins.holiday; }) / 60).toFixed(2), kd(t(function (r) { return r.otAmount; })), kd(t(function (r) { return r.total; }))]);
    y = table(doc, y, [["No.", 8], ["Name", 34, "left"], ["Emp. ID", 16], ["Shift", 15], ["Salary KD", 19, "right"], ["Hourly", 14, "right"], ["OT h", 12, "right"],
      ["Rest h", 12, "right"], ["Hol. h", 12, "right"], ["OT KD", 18, "right"], ["Total KD", 22, "right"]], rows, { boldLast: true });

    if (y + 30 > 280) { doc.addPage(); y = 20; } else { y += 16; }
    doc.setFontSize(9.5);
    [["Prepared by", data.by || ""], ["Approved by", ""], ["Date", ""]].forEach(function (f, i) {
      var x = M + i * 62;
      doc.text(f[0] + ":", x, y);
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.line(x, y + 9, x + 54, y + 9);
      if (f[1]) doc.text(f[1], x, y + 7);
    });
    footer(doc, { claimNo: "Payroll " + data.label });
    return doc;
  }

  window.EZPdf = { build: build, buildMonthly: buildMonthly, buildPayroll: buildPayroll, date: d, kd: kd };
})();
