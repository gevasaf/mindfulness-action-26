// The connection to the server (Supabase) for circles, teacher meditations and
// admin (design-v2 §9), and what those pages share:
//   - Backend.on: true once assets/js/config.js points at the Supabase project.
//     Until then everything marked data-backend stays hidden (design: no "בקרוב").
//   - Backend.db(): the Supabase client, loaded on first use.
//   - Backend.phoneAuth(el): "enter your number, get a code" (stack F5, F6). One
//     sign-in serves every page (circles, teachers, admin): Supabase keeps the
//     session (tied to the verified phone in auth.users) in this browser's
//     localStorage and refreshes it, so the same phone doesn't need another SMS
//     until it signs out or the data is deleted on 30.11. No cookies.
//   - Backend.msg(result): a gentle Hebrew message for each error code.
//   - Dates, times, calendar files, the localities list.
// The map lives in map.js.
(function () {
  var C = window.SITE_CONFIG || {};
  var ON = !!(C.supabaseUrl && C.supabaseAnonKey);
  document.documentElement.classList.toggle("has-backend", ON);

  var Backend = window.Backend = { on: ON, config: C };
  var BASE = new URL(".", document.currentScript ? document.currentScript.src.replace(/assets\/js\/[^/]*$/, "") : location.href).href;
  Backend.url = function (path) { return new URL(path, BASE).href; };

  // ---------- loading ----------
  var loaded = {};
  Backend.script = function (src) {
    if (!loaded[src]) loaded[src] = new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = Backend.url(src); s.async = true; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
    return loaded[src];
  };
  Backend.css = function (href) {
    if (!loaded[href]) {
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = Backend.url(href);
      document.head.appendChild(l); loaded[href] = Promise.resolve();
    }
    return loaded[href];
  };

  var client = null;
  Backend.db = function () {
    if (!ON) return Promise.reject(new Error("server not configured"));
    return Backend.script("assets/vendor/supabase/supabase.js").then(function () {
      if (!client) client = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, {
        auth: { storageKey: "nochechim-auth", persistSession: true, autoRefreshToken: true }  // localStorage (Supabase default)
      });
      return client;
    });
  };
  Backend.rpc = function (name, args) {
    return Backend.db().then(function (db) { return db.rpc(name, args || {}); }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  };
  Backend.fn = function (name, body) {
    return Backend.db().then(function (db) { return db.functions.invoke(name, { body: body }); }).then(function (r) {
      if (r.data) return r.data;
      // Non-2xx replies still carry our JSON error body
      if (r.error && r.error.context && r.error.context.json) return r.error.context.json().catch(function () { return { ok: false, error: "server" }; });
      return { ok: false, error: "server" };
    });
  };

  // ---------- messages ----------
  var MSG = {
    title_length: "הכותרת צריכה להיות באורך 3 עד 60 תווים.",
    description_length: "התיאור צריך להיות באורך 3 עד 200 תווים.",
    place_length: "שם המקום צריך להיות באורך 2 עד 80 תווים.",
    name_length: "השם ארוך מדי.",
    bio_length: "המשפט על עצמך ארוך מדי (עד 120 תווים).",
    consents: "צריך לסמן את כל ההסכמות.",
    text_link: "בלי קישורים בטקסט, בבקשה. מי שירצה פרטים יכתוב לך בוואטסאפ.",
    text_phone: "בלי מספרי טלפון בטקסט, בבקשה. הכפתור \"לתאם בוואטסאפ\" כבר מחבר אלייך.",
    time: "השעה צריכה להיות בין 06:00 ל-21:30, ברבעי שעה.",
    time_past: "השעה הזו כבר עברה היום.",
    date: "התאריך צריך להיות מהיום ועד יום הבחירות, 27.10.",
    election_day_hours: "ביום הבחירות מתחילים מ-07:00, כשהקלפיות פתוחות.",
    weekday: "צריך לבחור יום בשבוע.",
    kind: "צריך לבחור: חד-פעמי או כל שבוע.",
    outside_map: "הסימון מחוץ לאזור המפה.",
    in_sea: "הסימון נראה בתוך הים. אפשר להזיז אותו קצת ליבשה.",
    locality: "צריך לבחור יישוב מהרשימה.",
    daily_limit: "אפשר לפתוח עוד מעגל מחר.",
    duplicate: "נראה שהמעגל הזה כבר קיים.",
    files: "הקבצים לא הועלו כמו שצריך. אפשר לנסות שוב.",
    auth: "צריך לאמת את מספר הטלפון שוב.",
    captcha: "הבדיקה נגד רובוטים לא עברה. אפשר לנסות שוב.",
    not_found: "המעגל לא נמצא. אולי הוא כבר נמחק.",
    server: "משהו השתבש אצלנו. אפשר לנסות שוב בעוד רגע."
  };
  Backend.msg = function (r, overrides) {
    if (!r) return MSG.server;
    if (r.error === "text_ai" && r.message) return r.message;
    if (r.error === "far_from_locality") return "הסימון רחוק מ" + (r.locality || "היישוב שנבחר") + ". לבדוק?";
    return (overrides && overrides[r.error]) || MSG[r.error] || MSG.server;
  };

  Backend.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  // ---------- dates (Israel time) ----------
  Backend.ELECTION = "2026-10-27";
  var DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  Backend.DAYS = DAYS;
  Backend.today = function () {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  };
  Backend.nowTime = function () {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  };
  Backend.addDays = function (iso, n) {
    var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  Backend.weekday = function (iso) { return new Date(iso + "T12:00:00Z").getUTCDay(); };
  Backend.dayLabel = function (iso) {
    var p = iso.split("-");
    return "יום " + DAYS[Backend.weekday(iso)] + ", " + (+p[2]) + "." + (+p[1]);
  };
  Backend.whenText = function (c) {
    if (c.kind === "weekly") return "כל יום " + DAYS[c.weekday] + " ב-" + c.start_time + ", עד 27.10";
    return Backend.dayLabel(c.on_date) + " · " + c.start_time;
  };

  // A calendar event for a circle. Times are local (TZID), so the weekly series
  // keeps its hour across the clock change on 25.10.
  Backend.circleIcs = function (c, pageUrl) {
    function stamp(iso, hm) { return iso.replace(/-/g, "") + "T" + hm.replace(":", "") + "00"; }
    function esc(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
    var start = c.next_date || c.on_date;
    var endHm = (function () { var p = c.start_time.split(":"); var m = +p[0] * 60 + +p[1] + 30; return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + m % 60).slice(-2); })();
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//nochechim//circle//HE", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      "UID:circle-" + c.id + "@nochechim", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
      "DTSTART;TZID=Asia/Jerusalem:" + stamp(start, c.start_time), "DTEND;TZID=Asia/Jerusalem:" + stamp(start, endHm),
      "SUMMARY:" + esc("מעגל נשימה: " + c.title),
      "LOCATION:" + esc(c.place_name + ", " + c.locality),
      "DESCRIPTION:" + esc(c.description + "\n\nחצי שעה. לתאם עם מי שפתח/ה את המעגל: " + pageUrl + "\nאנחנו לא אומרים לכם למי להצביע, ולעולם לא נשאל אתכם למי תצביעו."),
      "URL:" + pageUrl];
    if (c.kind === "weekly") lines.push("RRULE:FREQ=WEEKLY;UNTIL=20261027T235959Z");
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc("עוד שעה: מעגל נשימה"), "TRIGGER:-PT1H", "END:VALARM", "END:VEVENT", "END:VCALENDAR");
    return lines.join("\r\n");
  };
  Backend.download = function (text, name, type) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type || "text/calendar;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  // ---------- localities ----------
  var locs = null;
  Backend.localities = function () {
    if (!locs) locs = fetch(Backend.url("assets/map/localities.json")).then(function (r) { return r.json(); });
    return locs;
  };

  // ---------- Turnstile (stack F6) ----------
  Backend.turnstile = function (el) {
    if (!C.turnstileSiteKey) return Promise.resolve({ token: function () { return undefined; }, reset: function () {} });
    return Backend.script("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit").then(function () {
      return new Promise(function (ok) {
        (function wait() { if (window.turnstile) ok(); else setTimeout(wait, 50); })();
      });
    }).then(function () {
      var id = window.turnstile.render(el, { sitekey: C.turnstileSiteKey, language: "he", appearance: "interaction-only" });
      return { token: function () { return window.turnstile.getResponse(id) || undefined; }, reset: function () { window.turnstile.reset(id); } };
    });
  };

  // ---------- phone sign-in (stack F5) ----------
  // Israeli mobile numbers only (codes go by SMS). Returns E.164, or null.
  Backend.phone = function (raw) {
    var d = String(raw || "").replace(/[^\d+]/g, "");
    if (/^\+9725\d{8}$/.test(d)) return d;
    if (/^9725\d{8}$/.test(d)) return "+" + d;
    if (/^05\d{8}$/.test(d)) return "+972" + d.slice(1);
    return null;
  };
  // 9725XXXXXXXX (as Supabase stores it) -> 05X-XXXXXXX, for showing the user their own number
  Backend.localPhone = function (p) {
    var d = String(p || "").replace(/\D/g, "");
    if (/^9725\d{8}$/.test(d)) d = "0" + d.slice(3);
    return d.length === 10 ? d.slice(0, 3) + "-" + d.slice(3) : d;
  };
  Backend.session = function () {
    return Backend.db().then(function (db) { return db.auth.getSession(); }).then(function (r) { return r.data.session; });
  };
  Backend.signOut = function () { return Backend.db().then(function (db) { return db.auth.signOut(); }); };

  // Renders the two-step form into el and resolves with the session once the
  // code is verified. opts.lead: a sentence above the field.
  Backend.phoneAuth = function (el, opts) {
    opts = opts || {};
    var uid = "pa" + Math.random().toString(36).slice(2, 8);
    el.innerHTML =
      '<div class="pa">' +
        (opts.lead ? '<p class="pa-lead">' + opts.lead + "</p>" : "") +
        '<div class="pa-step" data-step="phone">' +
          '<div class="field"><label for="' + uid + '-p">מספר טלפון נייד<span class="hint">נשלח אליו קוד אימות ב-SMS.</span></label>' +
          '<input id="' + uid + '-p" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="050-0000000" maxlength="16"></div>' +
          '<div class="pa-captcha"></div>' +
          '<button type="button" class="btn" data-act="send">לשלוח קוד</button>' +
        "</div>" +
        '<div class="pa-step" data-step="code" hidden>' +
          '<div class="field"><label for="' + uid + '-c">הקוד שקיבלת ב-SMS</label>' +
          '<input id="' + uid + '-c" type="text" inputmode="numeric" autocomplete="one-time-code" dir="ltr" maxlength="8"></div>' +
          '<div class="btn-row"><button type="button" class="btn" data-act="verify">לאמת</button>' +
          '<button type="button" class="btn secondary" data-act="again">לשלוח שוב</button></div>' +
        "</div>" +
        '<p class="form-msg" role="status" aria-live="polite"></p>' +
      "</div>";
    var msg = el.querySelector(".form-msg");
    var phoneIn = el.querySelector('[data-step="phone"] input');
    var codeIn = el.querySelector('[data-step="code"] input');
    var captcha = Backend.turnstile(el.querySelector(".pa-captcha"));
    var phone = null;
    function say(t, bad) { msg.textContent = t || ""; msg.classList.toggle("bad", !!bad); }
    function busy(b, on) { b.disabled = on; b.classList.toggle("is-busy", on); }

    return new Promise(function (resolve) {
      el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]");
        if (!b) return;
        var act = b.getAttribute("data-act");
        if (act === "send" || act === "again") {
          phone = Backend.phone(phoneIn.value);
          if (!phone) { say("צריך מספר נייד ישראלי, למשל 050-1234567.", true); phoneIn.focus(); return; }
          busy(b, true); say("שולחים קוד...");
          Promise.all([Backend.db(), captcha]).then(function (x) {
            return x[0].auth.signInWithOtp({ phone: phone, options: { captchaToken: x[1].token() } });
          }).then(function (r) {
            busy(b, false);
            captcha.then(function (c) { c.reset(); });
            if (r.error) {
              var m = /captcha/i.test(r.error.message) ? "captcha" : (r.error.status === 429 ? "rate" : "send");
              say(m === "captcha" ? MSG.captcha : m === "rate" ? "נשלחו כבר קודים למספר הזה. אפשר לנסות שוב בעוד דקה." : "לא הצלחנו לשלוח קוד. כדאי לבדוק את המספר ולנסות שוב.", true);
              return;
            }
            el.querySelector('[data-step="phone"]').hidden = true;
            el.querySelector('[data-step="code"]').hidden = false;
            say("הקוד נשלח. הוא מגיע בדרך כלל תוך דקה.");
            codeIn.focus();
          }).catch(function () { busy(b, false); say(MSG.server, true); });
        } else if (act === "verify") {
          var code = codeIn.value.replace(/\D/g, "");
          if (code.length < 4) { say("צריך להקליד את הקוד מה-SMS.", true); codeIn.focus(); return; }
          busy(b, true); say("מאמתים...");
          Backend.db().then(function (db) { return db.auth.verifyOtp({ phone: phone, token: code, type: "sms" }); }).then(function (r) {
            busy(b, false);
            if (r.error || !r.data.session) { say("הקוד לא מתאים, או שפג תוקפו. אפשר לנסות שוב או לבקש קוד חדש.", true); return; }
            say("המספר אומת. הוא נשמר בדפדפן הזה, אז בפעם הבאה לא יישלח קוד שוב.");
            resolve(r.data.session);
          }).catch(function () { busy(b, false); say(MSG.server, true); });
        }
      });
      // Already signed in on this browser (any page: circles, teachers, admin): no new SMS.
      if (opts.reuse !== false) Backend.session().then(function (s) {
        if (!s || !s.user || !s.user.phone) return;
        el.innerHTML = '<p class="pa-signed">מחובר/ת עם <bdi dir="ltr">' + Backend.esc(Backend.localPhone(s.user.phone)) + "</bdi> · " +
          '<button type="button" class="linkish" data-act="signout">להתנתק</button></p>';
        el.querySelector('[data-act="signout"]').addEventListener("click", function () {
          Backend.signOut().then(function () { location.reload(); });
        });
        resolve(s);
      }).catch(function () {});
    });
  };

})();
