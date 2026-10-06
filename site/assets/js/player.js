// Global meditation player (site v0.2).
// One <audio> element lives outside <main>, so with the in-place navigation in
// main.js it keeps playing from page to page. UI:
//   - a bottom bar that fades in when playback starts and fades out on close;
//   - a full-screen overlay (expand icon) with a slow breathing gradient and
//     captions that fade in and out with each stanza.
// Any element with data-play="<id>" starts / toggles that meditation.
// Recordings: ElevenLabs voice + a quiet music bed, mixed in the repo; stanza
// timings from site/content/meditations/audio/<id>.json. See tech/design-doc.md.
(function () {
  var MEDITATIONS = {
    "behind-the-curtain": { title: "מאחורי הפרגוד", file: "מאחורי-הפרגוד.mp3" },
    "clarity-in-the-noise": { title: "בהירות בתוך הרעש", file: "בהירות-בתוך-הרעש.mp3" },
    "on-the-way-to-vote": { title: "בדרך לקלפי", file: "בדרך-לקלפי.mp3" }
  };
  window.MEDITATIONS = MEDITATIONS;
  var AUDIO_DIR = "content/meditations/audio/";

  var ICON = {
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>',
    expand: '<path d="M4 9V4h5v2H6v3zm11-5h5v5h-2V6h-3zM6 15v3h3v2H4v-5zm12 0h2v5h-5v-2h3z"/>',
    collapse: '<path d="M9 4v5H4V7h3V4zm6 0h2v3h3v2h-5zM4 15h5v5H7v-3H4zm11 0h5v2h-3v3h-2z"/>',
    close: '<path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4L12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/>',
    back: '<path d="M12 4a8 8 0 1 1-7.6 10.5l1.9-.6A6 6 0 1 0 12 6v3L7.5 5 12 1z"/><text x="12" y="15.6" font-size="6" text-anchor="middle" font-family="sans-serif" font-weight="700">15</text>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON[name] + "</svg>"; }

  function fmt(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ":" + (t % 60 < 10 ? "0" : "") + (t % 60); }

  var audio = new Audio();
  audio.preload = "none";
  var current = null;       // meditation id
  var stanzas = [];
  var started = false;      // a "listen" was counted for this play-through
  var caption = -2;

  // ---------- DOM (outside <main>, survives in-place navigation) ----------
  var bar = document.createElement("div");
  bar.className = "pbar";
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", "נגן מדיטציות");
  bar.hidden = true;
  bar.innerHTML =
    '<input type="range" class="pseek" data-p="seek" min="0" max="1000" step="1" value="0" aria-label="מיקום בהקלטה">' +
    '<div class="pbar-inner">' +
      '<button type="button" class="ibtn ibtn-main" data-p="toggle" aria-label="נגינה">' + icon("play") + "</button>" +
      '<div class="pbar-info">' +
        '<a class="pbar-title" data-p="title" href="meditations.html"></a>' +
        '<div class="pbar-meta"><bdi dir="ltr" data-p="time">0:00</bdi> · קול ממוחשב זמני</div>' +
      "</div>" +
      '<button type="button" class="ibtn" data-p="back" aria-label="15 שניות אחורה">' + icon("back") + "</button>" +
      '<button type="button" class="ibtn" data-p="expand" aria-label="מסך מלא">' + icon("expand") + "</button>" +
      '<button type="button" class="ibtn" data-p="close" aria-label="עצירה וסגירת הנגן">' + icon("close") + "</button>" +
    "</div>";

  var full = document.createElement("div");
  full.className = "pfull";
  full.setAttribute("role", "dialog");
  full.setAttribute("aria-modal", "true");
  full.setAttribute("aria-label", "מדיטציה במסך מלא");
  full.hidden = true;
  full.innerHTML =
    '<div class="pfull-bg" aria-hidden="true"><span></span><span></span><span></span></div>' +
    '<div class="pfull-top">' +
      '<a class="pfull-title" data-p="title" href="meditations.html"></a>' +
      '<button type="button" class="ibtn" data-p="collapse" aria-label="יציאה ממסך מלא">' + icon("collapse") + "</button>" +
    "</div>" +
    '<div class="pfull-caption" aria-live="polite"><p></p><p></p></div>' +
    '<div class="pfull-controls">' +
      '<input type="range" class="pseek" data-p="seek" min="0" max="1000" step="1" value="0" aria-label="מיקום בהקלטה">' +
      '<div class="pfull-row">' +
        '<bdi class="pfull-time" dir="ltr" data-p="time">0:00</bdi>' +
        '<button type="button" class="ibtn" data-p="back" aria-label="15 שניות אחורה">' + icon("back") + "</button>" +
        '<button type="button" class="ibtn ibtn-main ibtn-big" data-p="toggle" aria-label="נגינה">' + icon("play") + "</button>" +
        '<button type="button" class="ibtn" data-p="close" aria-label="עצירה וסגירת הנגן">' + icon("close") + "</button>" +
        '<span class="pfull-time pfull-note">קול ממוחשב זמני</span>' +
      "</div>" +
    "</div>";

  document.body.appendChild(bar);
  document.body.appendChild(full);

  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function each(attr, fn) { all('[data-p="' + attr + '"]').forEach(fn); }

  // ---------- state → UI ----------
  function syncButtons() {
    var playing = !!current && !audio.paused && !audio.ended;
    each("toggle", function (b) {
      b.innerHTML = icon(playing ? "pause" : "play");
      b.setAttribute("aria-label", playing ? "השהיה" : "נגינה");
    });
    all("[data-play]").forEach(function (b) {
      var mine = b.getAttribute("data-play") === current && playing;
      b.classList.toggle("is-playing", mine);
      var ic = b.querySelector(".play-ic");
      if (ic) ic.innerHTML = icon(mine ? "pause" : "play");
      b.setAttribute("aria-pressed", mine ? "true" : "false");
    });
  }

  function showBar() {
    if (!bar.hidden && bar.classList.contains("show")) return;
    bar.hidden = false;
    document.body.classList.add("has-pbar");
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add("show"); }); });
  }
  function hideBar() {
    bar.classList.remove("show");
    document.body.classList.remove("has-pbar");
    setTimeout(function () { if (!bar.classList.contains("show")) bar.hidden = true; }, 500);
  }

  // Two stacked paragraphs cross-fade: the new stanza fades in as the old fades out.
  function setCaption(text) {
    var ps = full.querySelectorAll(".pfull-caption p");
    var on = full.querySelector(".pfull-caption p.on");
    if (on && on.textContent === text) return;
    var next = on === ps[0] ? ps[1] : ps[0];
    if (on) on.classList.remove("on");
    next.textContent = text;
    if (text) next.classList.add("on");
  }

  function tick() {
    var t = audio.currentTime, d = audio.duration || 0;
    each("time", function (el) { el.textContent = fmt(t) + " / " + fmt(d); });
    each("seek", function (el) { if (d && document.activeElement !== el) el.value = Math.round(t / d * 1000); });
    if (audio.ended) return;
    var idx = -1;
    for (var i = 0; i < stanzas.length; i++) {
      if (t >= stanzas[i].start - 0.3 && t <= stanzas[i].end + 0.8) { idx = i; break; }
    }
    if (idx !== caption) { caption = idx; setCaption(idx >= 0 ? stanzas[idx].text : ""); }
  }

  // ---------- actions ----------
  function load(id) {
    current = id;
    started = false;
    stanzas = []; caption = -2; setCaption("");
    audio.src = AUDIO_DIR + id + ".mp3";
    each("title", function (a) { a.textContent = MEDITATIONS[id].title; a.href = "meditations.html#" + id; });
    fetch(AUDIO_DIR + id + ".json").then(function (r) { return r.json(); })
      .then(function (j) { if (current === id) { stanzas = j.stanzas || []; caption = -2; tick(); } })
      .catch(function () {});
  }

  function play(id) {
    if (id && MEDITATIONS[id] && id !== current) load(id);
    if (!current) return;
    if (audio.ended) audio.currentTime = 0;
    showBar();
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
  }

  function toggle(id) {
    if (id && id !== current) return play(id);
    if (audio.paused || audio.ended) play(); else audio.pause();
  }

  function stop() {
    audio.pause();
    closeFull();
    hideBar();
    try { audio.currentTime = 0; } catch (e) {}
    syncButtons();
  }

  var lastFocus = null;
  function openFull() {
    lastFocus = document.activeElement;
    full.hidden = false;
    document.documentElement.classList.add("pfull-open");
    requestAnimationFrame(function () { requestAnimationFrame(function () { full.classList.add("show"); }); });
    var c = full.querySelector('[data-p="collapse"]');
    if (c) c.focus();
  }
  function closeFull() {
    if (full.hidden) return;
    full.classList.remove("show");
    document.documentElement.classList.remove("pfull-open");
    setTimeout(function () { if (!full.classList.contains("show")) full.hidden = true; }, 500);
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
  }

  window.sitePlayer = { play: play, toggle: toggle, stop: stop, current: function () { return current; }, audio: audio };

  // ---------- events ----------
  audio.addEventListener("play", function () {
    if (!started) { started = true; window.countEvent("listen-" + current); }
    syncButtons();
  });
  audio.addEventListener("pause", syncButtons);
  audio.addEventListener("timeupdate", tick);
  audio.addEventListener("loadedmetadata", tick);
  audio.addEventListener("ended", function () {
    window.countEvent("listen-complete-" + current);
    started = false;
    setCaption("סוף המדיטציה. ואם עלה משהו קשה, קווי הסיוע נמצאים בתחתית כל עמוד.");
    syncButtons();
  });

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-play], [data-p]") : null;
    if (!t) return;
    if (t.hasAttribute("data-play")) { e.preventDefault(); toggle(t.getAttribute("data-play")); return; }
    switch (t.getAttribute("data-p")) {
      case "toggle": toggle(); break;
      case "back": audio.currentTime = Math.max(0, audio.currentTime - 15); break;
      case "expand": openFull(); break;
      case "collapse": closeFull(); break;
      case "close": stop(); break;
      case "title": closeFull(); break; // the link itself navigates (in place, via main.js)
    }
  });
  document.addEventListener("input", function (e) {
    if (e.target.getAttribute && e.target.getAttribute("data-p") === "seek" && audio.duration) {
      audio.currentTime = e.target.value / 1000 * audio.duration;
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !full.hidden) closeFull();
  });

  // Page-level play buttons are re-rendered on every in-place navigation.
  window.onPage(syncButtons);
})();
