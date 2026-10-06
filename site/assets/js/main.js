// Shared behaviour for every page: mobile menu, countdown, motion pause.
(function () {
  document.documentElement.classList.add("js");

  // Anonymous event count (GoatCounter: no cookies, no personal data). Only the event name is sent.
  window.countEvent = function (name) {
    try {
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: name, title: name, event: true });
    } catch (e) {}
  };

  // Mobile menu
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Countdown to election day, 27.10.2026. Polls open at 07:00 Israel time (UTC+2 after DST ends 25.10).
  var ELECTION = new Date("2026-10-27T07:00:00+02:00").getTime();
  var cd = document.querySelector("[data-countdown]");
  if (cd) {
    var parts = {
      d: cd.querySelector("[data-cd=d]"),
      h: cd.querySelector("[data-cd=h]"),
      m: cd.querySelector("[data-cd=m]")
    };
    var caption = document.querySelector("[data-countdown-caption]");
    var tick = function () {
      var left = ELECTION - Date.now();
      if (left <= 0) {
        cd.hidden = true;
        if (caption) caption.textContent = "היום, או כבר אחרי, יום הבחירות. הרגע הזה לא מובן מאליו.";
        return;
      }
      var mins = Math.floor(left / 60000);
      parts.d.textContent = Math.floor(mins / 1440);
      parts.h.textContent = Math.floor((mins % 1440) / 60);
      parts.m.textContent = mins % 60;
    };
    tick();
    setInterval(tick, 30000);
  }

  // "Send on WhatsApp" links: share this page's address (works on any domain)
  Array.prototype.forEach.call(document.querySelectorAll("[data-share-wa]"), function (a) {
    var url = location.href.split("#")[0] + a.getAttribute("data-share-wa");
    var title = a.closest("[data-meditation]") ? a.closest("[data-meditation]").querySelector("h3").textContent : document.title;
    a.href = "https://wa.me/?text=" + encodeURIComponent(title + ": רגע של נשימה לפני הבחירות.\n" + url);
    a.target = "_blank";
    a.rel = "noopener";
    a.addEventListener("click", function () { window.countEvent("share-meditation-whatsapp"); });
  });

  // Hero video strip (design-v0 §7): a pre-rendered ping-pong loop, no sound.
  // Skipped (poster image only) for reduced motion, data saver or slow connections.
  var video = document.querySelector("[data-hero-video]");
  var conn = navigator.connection || {};
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var slow = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "");
  if (video && !reduce && !slow) {
    [["webm", "video/webm"], ["mp4", "video/mp4"]].forEach(function (s) {
      var src = document.createElement("source");
      src.src = video.getAttribute("data-" + s[0]);
      src.type = s[1];
      video.appendChild(src);
    });
    video.addEventListener("playing", function () { video.classList.add("ready"); }, { once: true });
    video.load();
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  // Pause / resume the hero's slow motion (design-v0 §7: visible stop button)
  var motionBtn = document.querySelector(".motion-toggle");
  var hero = document.querySelector(".hero");
  if (motionBtn && hero) {
    motionBtn.addEventListener("click", function () {
      var paused = hero.classList.toggle("paused");
      if (video && video.currentSrc) { if (paused) video.pause(); else video.play(); }
      motionBtn.setAttribute("aria-pressed", paused ? "true" : "false");
      motionBtn.textContent = paused ? "להפעיל תנועה" : "לעצור תנועה";
    });
  }
})();
