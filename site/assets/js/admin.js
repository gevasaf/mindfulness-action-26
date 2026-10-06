// admin.html: the founder's review page (design-v2 §9). Sign in with the
// founder's phone; every function also checks is_admin() in the database, so
// this page shows nothing to anyone else.
(function () {
  var Backend = window.Backend;
  var esc = Backend.esc;
  var root = document.getElementById("admin");
  var STATUS = { uploaded: "הועלתה", processing: "בעיבוד", review: "ממתינה לאישור", approved: "אושרה, מתפרסמת", published: "באתר",
                 rejected: "נדחתה", failed: "נכשלה בבדיקה", removed: "הוסרה" };
  var RULES = { partisan: "מפלגות / מועמדים", voting_advice: "עצה בעד מי להצביע", us_vs_them: "\"אנחנו\" מול \"הם\"", fear: "הפחדה",
                trauma: "רגישות לטראומה", promotion: "פרסום עצמי", offensive: "פוגעני" };
  var TAGS = { home: "בבית", way: "בדרך", sleep: "לפני השינה" };
  var db = null;

  function signed(path) {
    if (!path) return Promise.resolve(null);
    return db.storage.from("submissions").createSignedUrl(path, 3600).then(function (r) { return r.data && r.data.signedUrl; });
  }

  function submissionCard(s) {
    var ai = s.ai_review || {}, sugg = ai.suggested_tags || [];
    var tags = (s.tags && s.tags.length ? s.tags : sugg);
    return '<article class="adm-card" data-sid="' + esc(s.id) + '">' +
      '<div class="tm-who"><img data-photo="' + esc(s.photo_path) + '" alt="" width="72" height="72">' +
      '<div><p class="tm-name">' + esc(s.teacher_name) + '</p><p class="tm-bio">' + esc(s.bio || "") + "</p></div></div>" +
      "<h3>" + esc(s.title) + ' <span class="tag">' + esc(STATUS[s.status] || s.status) + "</span></h3>" +
      "<p>" + esc(s.description) + "</p>" +
      '<p class="player-meta">' + (s.duration_sec ? "כ-" + Math.round(s.duration_sec / 60) + " דקות · " : "") +
        (s.add_music ? "עם מוזיקת רקע" : "בלי מוזיקה") + " · הועלתה " + new Date(s.created_at).toLocaleString("he-IL") + "</p>" +
      (s.status_note ? '<p class="form-msg bad">' + esc(s.status_note) + "</p>" : "") +
      '<div class="adm-audio"><p>הגרסה שתתפרסם:</p><audio controls preload="none" data-audio="' + esc(s.mixed_path || "") + '"></audio>' +
        '<p>ההקלטה המקורית:</p><audio controls preload="none" data-audio="' + esc(s.audio_path) + '"></audio></div>' +
      (s.ai_review ? '<div class="adm-ai"><p><b>דירוג אוטומטי:</b> רלוונטיות ' + esc(ai.relevance || "?") + "/5. " + esc(ai.summary_he || "") + "</p>" +
        ((ai.violations || []).length ? "<ul>" + ai.violations.map(function (v) {
          return "<li><b>" + esc(RULES[v.rule] || v.rule) + ":</b> \"" + esc(v.quote) + "\" · " + esc(v.explanation_he) + "</li>";
        }).join("") + "</ul>" : "<p>לא נמצאו הפרות.</p>") + "</div>" : "") +
      (s.transcript ? "<details><summary>תמלול</summary><p class=\"adm-transcript\">" + esc(s.transcript) + "</p></details>" : "") +
      (["review", "failed", "rejected"].indexOf(s.status) >= 0 ?
        '<fieldset class="field adm-tags"><legend>מתאים ל:</legend>' + Object.keys(TAGS).map(function (t) {
          return '<label><input type="checkbox" value="' + t + '"' + (tags.indexOf(t) >= 0 ? " checked" : "") + "> " + TAGS[t] + "</label>";
        }).join(" ") + "</fieldset>" +
        '<div class="btn-row"><button type="button" class="btn" data-adm="approve">לאשר</button>' +
        '<button type="button" class="btn secondary" data-adm="reject">לדחות</button></div>' : "") +
      (["published", "approved"].indexOf(s.status) >= 0 ? '<div class="btn-row"><button type="button" class="btn secondary" data-adm="remove">להסיר מהאתר</button></div>' : "") +
      '<p class="form-msg" role="status"></p></article>';
  }

  function circleRow(c) {
    var flags = (c.hidden ? '<span class="tag">מוסתר</span> ' : "") + (c.needs_review ? '<span class="tag">בדיקת הטקסט לא רצה</span> ' : "") +
      (c.reports.length ? '<span class="tag">' + c.reports.length + " דיווחים</span>" : "");
    return '<article class="adm-card" data-cid="' + esc(c.id) + '"><h3>' + esc(c.title) + " " + flags + "</h3>" +
      '<p class="cc-when">' + esc(Backend.whenText(c)) + " · " + esc(c.place_name) + ", " + esc(c.locality) + "</p><p>" + esc(c.description) + "</p>" +
      (c.first_name ? "<p>פותח/ת: " + esc(c.first_name) + "</p>" : "") +
      (c.reports.length ? "<ul>" + c.reports.map(function (r) { return "<li>" + esc(r.reason || "(בלי פירוט)") + " · " + new Date(r.at).toLocaleString("he-IL") + "</li>"; }).join("") + "</ul>" : "") +
      '<div class="btn-row">' + (c.hidden || c.needs_review ? '<button type="button" class="btn" data-adm="show">בסדר, להציג</button>' : '<button type="button" class="btn secondary" data-adm="hide">להסתיר</button>') +
      '<button type="button" class="btn secondary" data-adm="delete">למחוק</button></div><p class="form-msg" role="status"></p></article>';
  }

  function load() {
    var main = root.querySelector("[data-panel]");
    main.innerHTML = "<p>טוענים...</p>";
    Backend.rpc("admin_overview").then(function (o) {
      var subs = o.submissions || [], circles = o.circles || [];
      var groups = [
        ["ממתינות לאישור", subs.filter(function (s) { return s.status === "review" || s.status === "failed"; })],
        ["בעיבוד", subs.filter(function (s) { return s.status === "uploaded" || s.status === "processing" || s.status === "approved"; })],
        ["באתר", subs.filter(function (s) { return s.status === "published"; })],
        ["נדחו", subs.filter(function (s) { return s.status === "rejected"; })]
      ];
      var attention = circles.filter(function (c) { return c.hidden || c.needs_review || c.reports.length; });
      main.innerHTML =
        "<h2>מדיטציות</h2>" + groups.map(function (g) {
          return '<details class="adm-group"' + (g[0] !== "נדחו" ? " open" : "") + "><summary>" + g[0] + " (" + g[1].length + ")</summary>" +
            (g[1].length ? g[1].map(submissionCard).join("") : "<p>אין.</p>") + "</details>";
        }).join("") +
        "<h2>מעגלים</h2>" +
        '<details class="adm-group" open><summary>לבדיקה (' + attention.length + ")</summary>" + (attention.length ? attention.map(circleRow).join("") : "<p>אין.</p>") + "</details>" +
        '<details class="adm-group"><summary>כל המעגלים (' + circles.length + ")</summary>" + circles.map(circleRow).join("") + "</details>";
      main.querySelectorAll("img[data-photo]").forEach(function (img) { signed(img.getAttribute("data-photo")).then(function (u) { if (u) img.src = u; }); });
      main.querySelectorAll("audio[data-audio]").forEach(function (a) {
        var p = a.getAttribute("data-audio");
        if (!p) { a.replaceWith(Object.assign(document.createElement("span"), { textContent: "עוד לא מוכנה." })); return; }
        signed(p).then(function (u) { if (u) a.src = u; });
      });
    }).catch(function () { main.innerHTML = '<p class="form-msg bad">לא הצלחנו לטעון. המספר הזה מורשה?</p>'; });
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-adm]");
    if (!b) return;
    var card = b.closest(".adm-card"), out = card.querySelector(".form-msg"), act = b.getAttribute("data-adm");
    var sid = card.getAttribute("data-sid"), cid = card.getAttribute("data-cid"), call;
    if (act === "approve" || act === "reject") {
      var note = act === "reject" ? prompt("סיבה (לא חובה, נשמרת רק כאן):") : null;
      if (act === "reject" && note === null) return;
      var tags = Array.prototype.map.call(card.querySelectorAll(".adm-tags input:checked"), function (i) { return i.value; });
      call = Backend.rpc("admin_review_submission", { p_id: sid, p_approve: act === "approve", p_note: note || null, p_tags: tags });
    } else if (act === "remove") {
      if (!confirm("להסיר את המדיטציה מהאתר?")) return;
      call = Backend.rpc("admin_remove_meditation", { p_id: sid });
    } else if (act === "show" || act === "hide") {
      call = Backend.rpc("admin_set_circle_hidden", { p_id: cid, p_hidden: act === "hide" });
    } else if (act === "delete") {
      if (!confirm("למחוק את המעגל? אי אפשר לבטל.")) return;
      call = Backend.rpc("admin_delete_circle", { p_id: cid });
    }
    b.disabled = true; out.textContent = "...";
    call.then(function () { out.textContent = "בוצע."; setTimeout(load, 600); })
      .catch(function () { b.disabled = false; out.textContent = "לא הצליח. לנסות שוב?"; out.classList.add("bad"); });
  });

  if (!Backend.on) { root.innerHTML = "<p>האתר עוד לא מחובר לשרת. ההוראות ב-tech/backend-setup.md.</p>"; return; }
  Backend.phoneAuth(root.querySelector("[data-auth]"), { lead: "כניסה עם המספר של היוזם." }).then(function () {
    return Backend.db();
  }).then(function (client) {
    db = client;
    return Backend.rpc("is_admin");
  }).then(function (ok) {
    root.querySelector("[data-auth]").innerHTML = ok ? '<p>מחובר. <button type="button" class="linkish" data-out>יציאה</button></p>' : '<p class="form-msg bad">המספר הזה לא מורשה.</p>';
    var outBtn = root.querySelector("[data-out]");
    if (outBtn) outBtn.addEventListener("click", function () { Backend.signOut().then(function () { location.reload(); }); });
    if (ok) load();
  });
})();
