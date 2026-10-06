// Shared code for the v2 features (design-v2 §9): circles, teachers, admin.
//   - V2.on: true once assets/js/config.js points at the Supabase project. Until
//     then everything marked data-v2 stays hidden (design: no "בקרוב").
//   - V2.db(): the Supabase client, loaded on first use. The phone sign-in lives
//     in sessionStorage only (gone when the tab closes); no cookies.
//   - V2.phoneAuth(el): "enter your number, get a code" (stack F5, F6).
//   - V2.msg(result): a gentle Hebrew message for each error code.
//   - V2.map(el): the quiet, self-hosted map: site palette, no border lines,
//     no country or region names (design-v2 §7, §9; stack F8).
//   - Dates, times, calendar files.
(function () {
  var C = window.SITE_CONFIG || {};
  var ON = !!(C.supabaseUrl && C.supabaseAnonKey);
  document.documentElement.classList.toggle("v2-on", ON);

  var V2 = window.V2 = { on: ON, config: C };
  var BASE = new URL(".", document.currentScript ? document.currentScript.src.replace(/assets\/js\/[^/]*$/, "") : location.href).href;
  V2.url = function (path) { return new URL(path, BASE).href; };

  // ---------- loading ----------
  var loaded = {};
  V2.script = function (src) {
    if (!loaded[src]) loaded[src] = new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = V2.url(src); s.async = true; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
    return loaded[src];
  };
  V2.css = function (href) {
    if (!loaded[href]) {
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = V2.url(href);
      document.head.appendChild(l); loaded[href] = Promise.resolve();
    }
    return loaded[href];
  };

  var client = null;
  V2.db = function () {
    if (!ON) return Promise.reject(new Error("v2 not configured"));
    return V2.script("assets/vendor/supabase/supabase.js").then(function () {
      if (!client) client = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, {
        auth: { storage: window.sessionStorage, storageKey: "nochechim-auth", persistSession: true, autoRefreshToken: true }
      });
      return client;
    });
  };
  V2.rpc = function (name, args) {
    return V2.db().then(function (db) { return db.rpc(name, args || {}); }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  };
  V2.fn = function (name, body) {
    return V2.db().then(function (db) { return db.functions.invoke(name, { body: body }); }).then(function (r) {
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
  V2.msg = function (r, overrides) {
    if (!r) return MSG.server;
    if (r.error === "text_ai" && r.message) return r.message;
    if (r.error === "far_from_locality") return "הסימון רחוק מ" + (r.locality || "היישוב שנבחר") + ". לבדוק?";
    return (overrides && overrides[r.error]) || MSG[r.error] || MSG.server;
  };

  V2.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  // ---------- dates (Israel time) ----------
  V2.ELECTION = "2026-10-27";
  var DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  V2.DAYS = DAYS;
  V2.today = function () {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  };
  V2.nowTime = function () {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  };
  V2.addDays = function (iso, n) {
    var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  V2.weekday = function (iso) { return new Date(iso + "T12:00:00Z").getUTCDay(); };
  V2.dayLabel = function (iso) {
    var p = iso.split("-");
    return "יום " + DAYS[V2.weekday(iso)] + ", " + (+p[2]) + "." + (+p[1]);
  };
  V2.whenText = function (c) {
    if (c.kind === "weekly") return "כל יום " + DAYS[c.weekday] + " ב-" + c.start_time + ", עד 27.10";
    return V2.dayLabel(c.on_date) + " · " + c.start_time;
  };

  // A calendar event for a circle. Times are local (TZID), so the weekly series
  // keeps its hour across the clock change on 25.10.
  V2.circleIcs = function (c, pageUrl) {
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
  V2.download = function (text, name, type) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type || "text/calendar;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  // ---------- localities ----------
  var locs = null;
  V2.localities = function () {
    if (!locs) locs = fetch(V2.url("assets/map/localities.json")).then(function (r) { return r.json(); });
    return locs;
  };

  // ---------- Turnstile (stack F6) ----------
  V2.turnstile = function (el) {
    if (!C.turnstileSiteKey) return Promise.resolve({ token: function () { return undefined; }, reset: function () {} });
    return V2.script("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit").then(function () {
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
  V2.phone = function (raw) {
    var d = String(raw || "").replace(/[^\d+]/g, "");
    if (/^\+9725\d{8}$/.test(d)) return d;
    if (/^9725\d{8}$/.test(d)) return "+" + d;
    if (/^05\d{8}$/.test(d)) return "+972" + d.slice(1);
    return null;
  };
  V2.session = function () {
    return V2.db().then(function (db) { return db.auth.getSession(); }).then(function (r) { return r.data.session; });
  };
  V2.signOut = function () { return V2.db().then(function (db) { return db.auth.signOut(); }); };

  // Renders the two-step form into el and resolves with the session once the
  // code is verified. opts.lead: a sentence above the field.
  V2.phoneAuth = function (el, opts) {
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
    var captcha = V2.turnstile(el.querySelector(".pa-captcha"));
    var phone = null;
    function say(t, bad) { msg.textContent = t || ""; msg.classList.toggle("bad", !!bad); }
    function busy(b, on) { b.disabled = on; b.classList.toggle("is-busy", on); }

    return new Promise(function (resolve) {
      el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]");
        if (!b) return;
        var act = b.getAttribute("data-act");
        if (act === "send" || act === "again") {
          phone = V2.phone(phoneIn.value);
          if (!phone) { say("צריך מספר נייד ישראלי, למשל 050-1234567.", true); phoneIn.focus(); return; }
          busy(b, true); say("שולחים קוד...");
          Promise.all([V2.db(), captcha]).then(function (x) {
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
          V2.db().then(function (db) { return db.auth.verifyOtp({ phone: phone, token: code, type: "sms" }); }).then(function (r) {
            busy(b, false);
            if (r.error || !r.data.session) { say("הקוד לא מתאים, או שפג תוקפו. אפשר לנסות שוב או לבקש קוד חדש.", true); return; }
            say("המספר אומת.");
            resolve(r.data.session);
          }).catch(function () { busy(b, false); say(MSG.server, true); });
        }
      });
      if (opts.reuse !== false) V2.session().then(function (s) { if (s && s.user && s.user.phone) { el.innerHTML = ""; resolve(s); } }).catch(function () {});
    });
  };

  // ---------- the map (stack F8) ----------
  V2.RECT = [[34.15, 29.40], [35.95, 33.40]];  // a plain rectangle, not a border (design-v2 §9)
  var DROP = ["boundaries", "boundaries_country", "places_country", "places_region", "pois", "roads_shields", "roads_oneway", "address_label"];
  var mapLibs = null;
  function loadMapLibs() {
    if (!mapLibs) mapLibs = Promise.all([
      V2.css("assets/vendor/maplibre/maplibre-gl.css"),
      V2.script("assets/vendor/maplibre/maplibre-gl.js"),
      V2.script("assets/vendor/maplibre/pmtiles.js"),
      V2.script("assets/vendor/maplibre/basemaps.js")
    ]).then(function () {
      var protocol = new window.pmtiles.Protocol();
      window.maplibregl.addProtocol("pmtiles", protocol.tile);
      try { window.maplibregl.setRTLTextPlugin(V2.url("assets/vendor/maplibre/mapbox-gl-rtl-text.js"), true); } catch (e) {}
    });
    return mapLibs;
  }
  function style() {
    var dark = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
    var bm = window.basemaps;
    var f = Object.assign({}, bm.namedFlavor(dark ? "dark" : "light"), dark ? {
      background: "#1d1c1a", earth: "#22211e", water: "#1a2624", park_a: "#26302a", park_b: "#26302a", wood_a: "#26302a", wood_b: "#26302a",
      city_label: "#d8d2c6", city_label_halo: "#1d1c1a", subplace_label: "#a8a294", subplace_label_halo: "#1d1c1a"
    } : {
      background: "#f7f3ec", earth: "#f3eee4", water: "#d6e1df", park_a: "#e3eadf", park_b: "#dce5d8", wood_a: "#e3eadf", wood_b: "#dce5d8",
      scrub_a: "#ebe9de", scrub_b: "#e6e4d8", sand: "#efe7d6", beach: "#efe7d6", buildings: "#e9e2d6",
      city_label: "#4a463f", city_label_halo: "#f7f3ec", subplace_label: "#6b665d", subplace_label_halo: "#f7f3ec",
      roads_label_major: "#6b665d", roads_label_minor: "#837d72"
    });
    return {
      version: 8,
      glyphs: V2.url("assets/map/fonts/{fontstack}/{range}.pbf"),
      sources: { protomaps: { type: "vector", url: "pmtiles://" + V2.url("assets/map/region.pmtiles"),
        attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>' } },
      layers: bm.layers("protomaps", f, { lang: "he" }).filter(function (l) { return DROP.indexOf(l.id) < 0; })
    };
  }
  V2.map = function (el, opts) {
    opts = opts || {};
    return loadMapLibs().then(function () {
      var map = new window.maplibregl.Map({
        container: el, style: style(), bounds: opts.bounds || V2.RECT, fitBoundsOptions: { padding: 10 },
        maxBounds: [[33.6, 29.0], [36.5, 33.8]], minZoom: 6, maxZoom: 17, attributionControl: { compact: true },
        cooperativeGestures: !!opts.cooperative, dragRotate: false, pitchWithRotate: false
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "top-left");
      return new Promise(function (ok) { map.on("load", function () { ok(map); }); });
    });
  };
  V2.inRect = function (lat, lon) { return lat >= 29.40 && lat <= 33.40 && lon >= 34.15 && lon <= 35.95; };
  V2.km = function (a, b) {
    var R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.pow(Math.sin(dLon / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  };
})();
