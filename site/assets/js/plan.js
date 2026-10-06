// "My voting plan": runs entirely in the browser. What people type is never sent
// or stored (no cookies, no localStorage). The only network call is an anonymous
// GoatCounter event name ("plan-created" etc.), never the plan itself. design-v0 §8, §13.
(function () {
  var form = document.getElementById("plan-form");
  if (!form) return;

  var CEC_URL = "https://www.bechirot.gov.il/";
  var SITE_URL = location.origin + location.pathname.replace(/[^/]*$/, "");
  var SLOTS = {
    morning: { label: "בבוקר", time: "08:00" },
    noon: { label: "בצהריים", time: "12:00" },
    afternoon: { label: "אחר הצהריים", time: "16:00" },
    evening: { label: "בערב", time: "19:00" }
  };

  var out = document.getElementById("plan-result");
  var els = {
    when: out.querySelector("[data-pc=when]"),
    withWhom: out.querySelector("[data-pc=with]"),
    invite: out.querySelector("[data-pc=invite]"),
    inviteRow: out.querySelectorAll("[data-pc-row=invite]")
  };

  function clean(s) { return (s || "").replace(/\s+/g, " ").trim().slice(0, 60); }

  function read() {
    var slot = (form.querySelector("input[name=slot]:checked") || {}).value || "morning";
    var exact = form.elements.exact.value;
    var time = exact || SLOTS[slot].time;
    return {
      time: time,
      whenText: "יום שלישי, 27.10, " + (exact ? "בשעה " + exact : SLOTS[slot].label),
      withWhom: clean(form.elements.withWhom.value) || "לבד, ובשקט",
      invite: clean(form.elements.invite.value)
    };
  }

  function render(p) {
    els.when.textContent = p.whenText;
    els.withWhom.textContent = p.withWhom;
    els.invite.textContent = p.invite;
    Array.prototype.forEach.call(els.inviteRow, function (r) { r.hidden = !p.invite; });
  }

  function shareText(p) {
    return "התוכנית שלי ליום הבחירות:\n" +
      "מתי: " + p.whenText + "\n" +
      "עם מי: " + p.withWhom + "\n" +
      (p.invite ? "מזמין/ה גם את: " + p.invite + "\n" : "") +
      "\nלפני שבוחרים, נושמים. אפשר להכין תוכנית משלך כאן:\n" + SITE_URL + "#plan";
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function ics(p) {
    // Israel is UTC+2 on 27.10.2026 (DST ends 25.10). Store as UTC.
    var hm = p.time.split(":");
    var start = new Date(Date.UTC(2026, 9, 27, +hm[0] - 2, +hm[1]));
    var end = new Date(start.getTime() + 60 * 60000);
    var fmt = function (d) {
      return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + "T" +
        pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + "00Z";
    };
    var esc = function (s) { return s.replace(/\\/g, "\\\\").replace(/[,;]/g, "\\$&").replace(/\n/g, "\\n"); };
    var desc = "עם מי: " + p.withWhom + (p.invite ? "\nמזמין/ה: " + p.invite : "") +
      "\nלפני שבוחרים, נושמים.\nמקום הקלפי: " + CEC_URL;
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//nochechim//voting-plan//HE", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:plan-" + Date.now() + "@nochechim",
      "DTSTAMP:" + fmt(new Date()),
      "DTSTART:" + fmt(start), "DTEND:" + fmt(end),
      "SUMMARY:" + esc("הולכים להצביע"),
      "DESCRIPTION:" + esc(desc),
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc("עוד שעה: הולכים להצביע"), "TRIGGER:-PT1H", "END:VALARM",
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc("מחר יום הבחירות"), "TRIGGER:-PT18H", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
  }

  function download(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function wrap(ctx, text, maxW) {
    var words = text.split(" "), lines = [], line = "";
    words.forEach(function (w) {
      var t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  function cardImage(p) {
    var W = 1080, H = 1350;
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#e6ece4"); g.addColorStop(1, "#f4e4dc");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#6f8a72"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(W / 2, 230, 90, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(111,138,114,0.15)";
    ctx.beginPath(); ctx.arc(W / 2, 230, 60, 0, Math.PI * 2); ctx.fill();
    ctx.direction = "rtl"; ctx.textAlign = "center";
    ctx.fillStyle = "#4f6852"; ctx.font = "700 40px Assistant, sans-serif";
    ctx.fillText("נוכחים", W / 2, 400);
    ctx.fillStyle = "#2b2925"; ctx.font = "700 76px 'Frank Ruhl Libre', serif";
    ctx.fillText("התוכנית שלי להצביע", W / 2, 520);
    var y = 640;
    var row = function (label, value) {
      ctx.fillStyle = "#625d55"; ctx.font = "400 36px Assistant, sans-serif";
      ctx.fillText(label, W / 2, y); y += 66;
      ctx.fillStyle = "#2b2925"; ctx.font = "500 52px 'Frank Ruhl Libre', serif";
      wrap(ctx, value, W - 200).forEach(function (l) { ctx.fillText(l, W / 2, y); y += 66; });
      y += 30;
    };
    row("מתי", p.whenText);
    row("עם מי", p.withWhom);
    if (p.invite) row("מזמין/ה גם את", p.invite);
    ctx.fillStyle = "#2b2925"; ctx.font = "500 48px 'Frank Ruhl Libre', serif";
    ctx.fillText("לפני שבוחרים, נושמים.", W / 2, H - 120);
    return new Promise(function (res) { c.toBlob(res, "image/png"); });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    render(read());
    if (out.hidden) window.countEvent("plan-created");
    out.hidden = false;
    out.querySelector("h3").focus();
  });
  form.addEventListener("input", function () { if (!out.hidden) render(read()); });

  out.querySelector("[data-act=whatsapp]").addEventListener("click", function () {
    window.countEvent("plan-whatsapp");
    window.open("https://wa.me/?text=" + encodeURIComponent(shareText(read())), "_blank", "noopener");
  });
  out.querySelector("[data-act=calendar]").addEventListener("click", function () {
    window.countEvent("plan-calendar");
    download(new Blob([ics(read())], { type: "text/calendar;charset=utf-8" }), "voting-plan-27-10.ics");
  });
  out.querySelector("[data-act=image]").addEventListener("click", function () {
    window.countEvent("plan-image");
    var p = read();
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () { return cardImage(p); }).then(function (blob) {
      var file = new File([blob], "voting-plan.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], text: "לפני שבוחרים, נושמים." }).catch(function () {});
      } else {
        download(blob, "voting-plan.png");
      }
    });
  });
})();
