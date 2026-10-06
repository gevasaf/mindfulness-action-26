// Teacher meditations (design-v2 §9, part א):
//   - teachers.html: the upload form. Files go straight to the private
//     "submissions" bucket, into the teacher's own folder; then
//     submit_meditation records it. Nothing is public until the founder
//     approves it in admin.html and the worker publishes it.
//   - meditations.html: approved teacher meditations, with name, photo and one
//     sentence, filtered by length and by setting. They play in the site player.
(function () {
  var Backend = window.Backend;
  if (!Backend) return;
  var esc = Backend.esc;
  var TAGS = { home: "בבית", way: "בדרך", sleep: "לפני השינה" };
  var AUDIO_TYPES = /^(audio\/|video\/mp4$)/;
  var MAX_AUDIO = 50 * 1024 * 1024;
  var WA_ICON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

  // ---------- meditations page ----------
  function minutes(sec) { return Math.max(1, Math.round((sec || 0) / 60)); }
  window.onPage(function teacherMeditations() {
    var root = document.getElementById("teacher-meds");
    if (!root || !Backend.on) return;
    var listEl = root.querySelector("[data-list]");
    var lenSel = root.querySelector("#tm-length"), tagSel = root.querySelector("#tm-tag");
    var all = [];
    function render() {
      var len = lenSel.value, tag = tagSel.value;
      var list = all.filter(function (m) {
        var mins = minutes(m.duration_sec);
        if (len === "short" && mins > 5) return false;
        if (len === "mid" && (mins <= 5 || mins > 10)) return false;
        if (len === "long" && mins <= 10) return false;
        if (tag && (m.tags || []).indexOf(tag) < 0) return false;
        return true;
      });
      listEl.innerHTML = list.length ? list.map(function (m) {
        var id = "t-" + m.id;
        return '<article class="med-card teacher-med" id="' + id + '">' +
          '<div class="tm-who"><img src="' + esc(m.photo) + '" alt="" width="72" height="72" loading="lazy">' +
          '<div><p class="tm-name">' + esc(m.teacher_name) + "</p>" + (m.bio ? '<p class="tm-bio">' + esc(m.bio) + "</p>" : "") + "</div></div>" +
          '<div class="med-head"><h3>' + esc(m.title) + "</h3></div>" +
          '<p class="player-meta">כ-' + minutes(m.duration_sec) + " דקות" +
            ((m.tags || []).length ? " · " + m.tags.map(function (t) { return TAGS[t]; }).filter(Boolean).join(", ") : "") + "</p>" +
          "<p>" + esc(m.description) + "</p>" +
          '<div class="med-actions"><a class="btn" data-play="' + id + '" href="' + esc(m.audio) + '"><span class="play-ic"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z"/></svg></span>להאזנה</a>' +
          '<a class="btn secondary" data-share-wa="' + id + '" href="meditations.html#' + id + '" aria-label="שיתוף בוואטסאפ" title="שיתוף בוואטסאפ">' + WA_ICON + "שיתוף</a>" +
          '<a class="btn secondary" href="' + esc(m.audio) + '" download="' + esc(m.title.replace(/\s+/g, "-")) + '.mp3">להורדה</a></div>' +
          "</article>";
      }).join("") : (all.length ? "<p>אין מדיטציות שמתאימות לסינון הזה.</p>" : "");
      root.hidden = !all.length;
      if (window.onPage.rerunShare) window.onPage.rerunShare();
    }
    lenSel.addEventListener("change", render);
    tagSel.addEventListener("change", render);
    Backend.rpc("list_meditations").then(function (list) {
      all = list || [];
      all.forEach(function (m) {
        if (window.registerMeditation) window.registerMeditation("t-" + m.id, { title: m.title, src: m.audio, teacher: m.teacher_name });
      });
      render();
      if (location.hash && document.querySelector(location.hash)) document.querySelector(location.hash).scrollIntoView();
    }).catch(function () {});
  });

  // ---------- teachers page: upload form ----------
  function resizePhoto(file) {
    return new Promise(function (ok, fail) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 600 / Math.max(img.width, img.height));
        var cv = document.createElement("canvas");
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) { URL.revokeObjectURL(img.src); b ? ok(b) : fail(new Error("photo")); }, "image/jpeg", 0.85);
      };
      img.onerror = function () { fail(new Error("photo")); };
      img.src = URL.createObjectURL(file);
    });
  }
  function ext(name) { var m = /\.([a-z0-9]{2,4})$/i.exec(name || ""); return m ? m[1].toLowerCase() : "m4a"; }

  window.onPage(function teacherForm() {
    var form = document.getElementById("teacher-form");
    if (!form || !Backend.on) return;
    var f = form.elements, msg = form.querySelector("[data-form-msg]");
    function say(t, bad) { msg.textContent = t || ""; msg.classList.toggle("bad", !!bad); if (t) msg.scrollIntoView({ block: "nearest" }); }
    form.querySelectorAll("[data-count-for]").forEach(function (out) {
      var el = f[out.getAttribute("data-count-for")];
      var upd = function () { out.textContent = el.value.length + "/" + el.maxLength; };
      el.addEventListener("input", upd); upd();
    });
    // The recording's length, read in the browser, so a 2-hour file is caught before uploading
    var audioLen = null;
    f.audio.addEventListener("change", function () {
      audioLen = null;
      var file = f.audio.files[0], note = form.querySelector("[data-audio-note]");
      note.textContent = ""; note.classList.remove("bad");
      if (!file) return;
      if (file.size > MAX_AUDIO) { note.textContent = "הקובץ גדול מ-50MB. אפשר לשמור אותו בפורמט דחוס יותר (m4a או mp3)."; note.classList.add("bad"); return; }
      var a = new Audio(); a.preload = "metadata";
      a.onloadedmetadata = function () {
        audioLen = a.duration; URL.revokeObjectURL(a.src);
        var mins = Math.round(audioLen / 6) / 10;
        if (isFinite(audioLen) && (audioLen < 165 || audioLen > 930)) { note.textContent = "אורך ההקלטה " + mins + " דקות. צריך בין 3 ל-15 דקות."; note.classList.add("bad"); }
        else if (isFinite(audioLen)) note.textContent = "אורך ההקלטה: " + mins + " דקות.";
      };
      a.src = URL.createObjectURL(file);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var audio = f.audio.files[0], photo = f.photo.files[0];
      if (f.teacher_name.value.trim().length < 2) return say("צריך שם, כפי שיופיע באתר.", true);
      if (!photo || !/^image\//.test(photo.type)) return say("צריך תמונת פרופיל.", true);
      if (f.title.value.trim().length < 2) return say("צריך שם לתרגול.", true);
      if (f.description.value.trim().length < 3) return say("צריך תיאור קצר.", true);
      if (!audio || !(AUDIO_TYPES.test(audio.type) || /\.(m4a|mp3|wav|ogg|aac|webm)$/i.test(audio.name))) return say("צריך קובץ הקלטה (m4a, mp3, wav, ogg).", true);
      if (audio.size > MAX_AUDIO) return say("הקובץ גדול מ-50MB.", true);
      if (audioLen != null && isFinite(audioLen) && (audioLen < 165 || audioLen > 930)) return say("ההקלטה צריכה להיות באורך 3 עד 15 דקות.", true);
      if (!(f.c_rights.checked && f.c_license.checked && f.c_profile.checked && f.c_rules.checked && f.c_adult.checked)) return say("צריך לסמן את כל ההסכמות.", true);
      say("");
      form.querySelector("[data-continue]").hidden = true;
      var authBox = form.querySelector("[data-auth]");
      authBox.hidden = false;
      var session;
      Backend.phoneAuth(authBox, { lead: "אימות קצר של מספר הטלפון. הוא לא מוצג באתר אף פעם." }).then(function (s) {
        session = s;
        say("מעלים את הקבצים... זה יכול לקחת דקה.");
        return Promise.all([Backend.db(), resizePhoto(photo)]);
      }).then(function (x) {
        var db = x[0], uid = session.user.id, stamp = Date.now();
        var audioPath = uid + "/" + stamp + "-audio." + ext(audio.name), photoPath = uid + "/" + stamp + "-photo.jpg";
        return db.storage.from("submissions").upload(audioPath, audio, { contentType: audio.type || "audio/mp4" }).then(function (r) {
          if (r.error) throw r.error;
          return db.storage.from("submissions").upload(photoPath, x[1], { contentType: "image/jpeg" });
        }).then(function (r) {
          if (r.error) throw r.error;
          return Backend.rpc("submit_meditation", { p: {
            teacher_name: f.teacher_name.value.trim(), bio: f.bio.value.trim(), title: f.title.value.trim(),
            description: f.description.value.trim(), add_music: f.add_music.checked, audio_path: audioPath, photo_path: photoPath,
            consents: { rights: true, license: true, publish_profile: true, rules: true, adult: true } } });
        });
      }).then(function (r) {
        if (!r || !r.ok) { form.querySelector("[data-continue]").hidden = false; say(Backend.msg(r, { daily_limit: "אפשר להעלות עוד הקלטה מחר." }), true); return; }
        window.countEvent("meditation-upload");
        form.innerHTML = '<div class="oc-done"><h2>תודה.</h2><p>קיבלנו את ההקלטה. היא תיבדק ותעלה לאתר אחרי אישור.</p>' +
          '<div class="btn-row"><a class="btn" href="teachers.html">להעלות עוד אחת</a><a class="btn secondary" href="meditations.html">למדיטציות</a></div></div>';
        form.scrollIntoView({ block: "start" });
      }).catch(function (err) {
        if (window.console) console.error("teacher upload", err);
        form.querySelector("[data-continue]").hidden = false;
        say(err && /mime|type/i.test(err.message || "") ? "סוג הקובץ לא נתמך. אפשר לשמור את ההקלטה כ-m4a או mp3." :
            err && /size|large|exceed/i.test(err.message || "") ? "הקובץ גדול מדי (עד 50MB)." : Backend.msg(null), true);
      });
    });
  });
})();
