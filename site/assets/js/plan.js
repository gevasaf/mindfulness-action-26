// "My voting plan": runs entirely in the browser. What people type is never sent
// or stored (no cookies, no localStorage). The only network call is an anonymous
// GoatCounter event name ("plan-created" etc.), never the plan itself. design-v0 §8, §13.
//
// Fields (all optional): when, where (calendar only: never on the shared card or
// text, since a polling place reveals where someone lives), with whom, whom I
// invite, whom I dedicate the moment behind the curtain to (a fixed list, so a
// shared card can't carry a slogan), and a meditation for the way (its link goes
// into the calendar event).
window.onPage(function () {
  var form = document.getElementById("plan-form");
  if (!form) return;

  var CEC_URL = "https://www.bechirot.gov.il/";
  var SITE_URL = new URL("./", location.href).href;
  var SLOTS = {
    morning: { label: "בבוקר", time: "08:00" },
    noon: { label: "בצהריים", time: "12:00" },
    afternoon: { label: "אחר הצהריים", time: "16:00" },
    evening: { label: "בערב", time: "19:00" }
  };
  var MED_MINUTES = { "on-the-way-to-vote": 2, "behind-the-curtain": 7, "clarity-in-the-noise": 3 };

  var out = document.getElementById("plan-result");
  function pc(name) { return out.querySelector('[data-pc="' + name + '"]'); }
  function rows(name) { return out.querySelectorAll('[data-pc-row="' + name + '"]'); }

  function clean(s) { return (s || "").replace(/\s+/g, " ").trim().slice(0, 60); }

  function read() {
    var slot = (form.querySelector("input[name=slot]:checked") || {}).value || "morning";
    var exact = form.elements.exact.value;
    var med = form.elements.meditation.value;
    var meds = window.MEDITATIONS || {};
    return {
      time: exact || SLOTS[slot].time,
      whenText: "יום שלישי, 27.10, " + (exact ? "בשעה " + exact : SLOTS[slot].label),
      where: clean(form.elements.where.value),
      withWhom: clean(form.elements.withWhom.value) || "לבד, ובשקט",
      invite: clean(form.elements.invite.value),
      dedication: form.elements.dedication.value,
      med: meds[med] ? med : "",
      medTitle: meds[med] ? meds[med].title : "",
      medUrl: meds[med] ? new URL("meditations.html#" + med, location.href).href : ""
    };
  }

  function render(p) {
    pc("when").textContent = p.whenText;
    pc("with").textContent = p.withWhom;
    pc("invite").textContent = p.invite;
    pc("dedication").textContent = p.dedication;
    pc("med").textContent = p.medTitle;
    [["invite", p.invite], ["dedication", p.dedication], ["med", p.medTitle]].forEach(function (x) {
      Array.prototype.forEach.call(rows(x[0]), function (r) { r.hidden = !x[1]; });
    });
  }

  function shareText(p) {
    return "התוכנית שלי ליום הבחירות:\n" +
      "מתי: " + p.whenText + "\n" +
      "עם מי: " + p.withWhom + "\n" +
      (p.invite ? "מזמין/ה גם את: " + p.invite + "\n" : "") +
      (p.dedication ? "את הרגע מאחורי הפרגוד אני מקדיש/ה " + p.dedication + "\n" : "") +
      (p.medTitle ? "בדרך אקשיב למדיטציה \"" + p.medTitle + "\"\n" : "") +
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
    // Lines longer than 75 octets are folded (RFC 5545); calendars unfold them.
    var fold = function (line) {
      var outL = [], cur = "";
      Array.from(line).forEach(function (ch) {
        if (new Blob([cur + ch]).size > 72) { outL.push(cur); cur = " " + ch; } else cur += ch;
      });
      outL.push(cur);
      return outL.join("\r\n");
    };
    var desc = ["לפני שבוחרים, נושמים.", "", "עם מי: " + p.withWhom];
    if (p.invite) desc.push("מזמין/ה: " + p.invite);
    if (p.dedication) desc.push("את הרגע מאחורי הפרגוד אני מקדיש/ה " + p.dedication);
    if (p.medTitle) desc.push("", "מדיטציה לפני היציאה או בדרך: " + p.medTitle + " (כ-" + MED_MINUTES[p.med] + " דקות)", p.medUrl);
    desc.push("", "איפה הקלפי שלי: " + CEC_URL, "להזמין עוד מישהו להכין תוכנית: " + SITE_URL + "#plan");
    var alarm = "עוד שעה: הולכים להצביע" + (p.medTitle ? ". לפני היציאה: " + p.medTitle : "");
    var lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//nochechim//voting-plan//HE", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:plan-" + Date.now() + "@nochechim",
      "DTSTAMP:" + fmt(new Date()),
      "DTSTART:" + fmt(start), "DTEND:" + fmt(end),
      "SUMMARY:" + esc("הולכים להצביע"),
      "DESCRIPTION:" + esc(desc.join("\n"))
    ];
    if (p.where) lines.push("LOCATION:" + esc(p.where));
    if (p.medUrl) lines.push("URL:" + p.medUrl);
    lines.push(
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc(alarm), "TRIGGER:-PT1H", "END:VALARM",
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc("מחר יום הבחירות"), "TRIGGER:-PT18H", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    );
    return lines.map(fold).join("\r\n");
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
    var items = [["מתי", p.whenText], ["עם מי", p.withWhom]];
    if (p.invite) items.push(["מזמין/ה גם את", p.invite]);
    if (p.dedication) items.push(["את הרגע מאחורי הפרגוד אני מקדיש/ה", p.dedication]);
    if (p.medTitle) items.push(["מדיטציה לדרך", p.medTitle]);
    var W = 1080, H = 1350 + Math.max(0, items.length - 3) * 150;
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#e6ece4"); g.addColorStop(1, "#f4e4dc");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#6f8a72"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(W / 2, 200, 80, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(111,138,114,0.15)";
    ctx.beginPath(); ctx.arc(W / 2, 200, 52, 0, Math.PI * 2); ctx.fill();
    ctx.direction = "rtl"; ctx.textAlign = "center";
    ctx.fillStyle = "#4f6852"; ctx.font = "700 40px Assistant, sans-serif";
    ctx.fillText("נוכחים", W / 2, 350);
    ctx.fillStyle = "#2b2925"; ctx.font = "700 76px 'Frank Ruhl Libre', serif";
    ctx.fillText("התוכנית שלי להצביע", W / 2, 470);
    var y = 590;
    items.forEach(function (it) {
      ctx.fillStyle = "#625d55"; ctx.font = "400 36px Assistant, sans-serif";
      ctx.fillText(it[0], W / 2, y); y += 64;
      ctx.fillStyle = "#2b2925"; ctx.font = "500 52px 'Frank Ruhl Libre', serif";
      wrap(ctx, it[1], W - 200).forEach(function (l) { ctx.fillText(l, W / 2, y); y += 64; });
      y += 26;
    });
    ctx.fillStyle = "#2b2925"; ctx.font = "500 48px 'Frank Ruhl Libre', serif";
    ctx.fillText("לפני שבוחרים, נושמים.", W / 2, H - 110);
    return new Promise(function (res) { c.toBlob(res, "image/png"); });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    render(read());
    if (out.hidden) window.countEvent("plan-created");
    window.planMade = true; // in memory only: the player stops suggesting a plan
    out.hidden = false;
    out.querySelector("h3").focus();
  });
  form.addEventListener("input", function () { if (!out.hidden) render(read()); });
  form.addEventListener("change", function () { if (!out.hidden) render(read()); });

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
});
