// Shared behaviour for every page (site v0.2):
//   - window.onPage(fn): page set-up that runs on load and after every in-place navigation;
//   - in-place navigation: site links swap <main> instead of reloading, so the
//     meditation player (player.js, outside <main>) keeps playing across pages.
//     Without JS, or if a fetch fails, links are ordinary page loads;
//   - logo breath on hover, mobile menu, countdown, WhatsApp share links, hero video, motion pause.
(function () {
  document.documentElement.classList.add("js");

  var inits = [];
  window.onPage = function (fn) { inits.push(fn); };
  function runInits() { inits.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }

  // Anonymous event count (GoatCounter: no cookies, no personal data). Only the event name is sent.
  window.countEvent = function (name) {
    try {
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: name, title: name, event: true });
    } catch (e) {}
  };

  // ---------- logo: one full breath on hover, focus or touch (header is static, bind once) ----------
  var mark = document.querySelector(".brand-mark");
  var brand = document.querySelector(".brand");
  if (mark && brand) {
    var breathe = function () { brand.classList.add("breathing"); };
    brand.addEventListener("mouseenter", breathe);
    brand.addEventListener("focus", breathe);
    brand.addEventListener("touchstart", breathe, { passive: true }); // phones have no hover
    mark.addEventListener("animationend", function (e) { if (e.target === mark) brand.classList.remove("breathing"); });
  }

  // ---------- mobile menu (header is static, bind once) ----------
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  function closeMenu() { if (nav) nav.classList.remove("open"); if (toggle) toggle.setAttribute("aria-expanded", "false"); }
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // ---------- in-place navigation ----------
  var loadedPath = location.pathname;

  function sameSite(a) {
    if (!a || !a.href || a.target || a.hasAttribute("download") || a.hasAttribute("data-play") || a.hasAttribute("data-no-swap")) return false;
    var u = new URL(a.href, location.href);
    if (u.origin !== location.origin) return false;
    return /(\/|\.html)$/.test(u.pathname);
  }

  function scrollToTarget(hash) {
    var el = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    // pushState doesn't update :target, so mark the target with a class too
    Array.prototype.forEach.call(document.querySelectorAll(".is-target"), function (x) { x.classList.remove("is-target"); });
    if (el) { el.classList.add("is-target"); el.scrollIntoView(); } else window.scrollTo(0, 0);
  }

  function swap(url, push) {
    var u = new URL(url, location.href);
    return fetch(u.pathname + u.search).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var newMain = doc.querySelector("main#main");
      var oldMain = document.querySelector("main#main");
      if (!newMain || !oldMain) throw new Error("no main");
      if (push) history.pushState({}, "", u.href);
      oldMain.replaceWith(document.importNode(newMain, true));
      document.title = doc.title;
      var d = doc.querySelector('meta[name="description"]'), md = document.querySelector('meta[name="description"]');
      if (d && md) md.setAttribute("content", d.getAttribute("content"));
      var newNav = doc.getElementById("site-nav");
      if (newNav && nav) nav.innerHTML = newNav.innerHTML;
      loadedPath = u.pathname;
      closeMenu();
      runInits();
      scrollToTarget(u.hash);
      if (!u.hash) {
        var h1 = document.querySelector("main h1");
        if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
      }
      try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: u.pathname }); } catch (e) {}
    }).catch(function () { location.href = u.href; });
  }

  if (window.fetch && window.DOMParser && history.pushState) {
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest("a[href]") : null;
      if (!sameSite(a)) return;
      var u = new URL(a.href, location.href);
      if (u.pathname === location.pathname && u.search === location.search) {
        if (u.hash) return;            // same page anchor: browser default
        e.preventDefault(); window.scrollTo(0, 0); return;
      }
      e.preventDefault();
      swap(u.href, true);
    });
    window.addEventListener("popstate", function () {
      if (location.pathname !== loadedPath) swap(location.href, false);
    });
  }

  // ---------- per-page set-up ----------
  var countdownTimer = null;
  window.onPage(function countdown() {
    clearInterval(countdownTimer);
    // Election day, 27.10.2026. Polls open at 07:00 Israel time (UTC+2 after DST ends 25.10).
    var ELECTION = new Date("2026-10-27T07:00:00+02:00").getTime();
    var cd = document.querySelector("[data-countdown]");
    if (!cd) return;
    var parts = { d: cd.querySelector("[data-cd=d]"), h: cd.querySelector("[data-cd=h]"), m: cd.querySelector("[data-cd=m]") };
    var caption = document.querySelector("[data-countdown-caption]");
    // After the countdown, the caption follows the days (Israel time, UTC+2):
    // 27.10 07:00-22:00 polls open · 27.10 22:00 until 28.10 ends: the day after · then thanks.
    var CLOSE = new Date("2026-10-27T22:00:00+02:00").getTime();
    var AFTER_END = new Date("2026-10-29T00:00:00+02:00").getTime();
    var tick = function () {
      var now = Date.now(), left = ELECTION - now;
      if (left <= 0) {
        cd.hidden = true;
        if (caption) {
          caption.innerHTML = now < CLOSE
            ? 'היום יום הבחירות. הקלפיות פתוחות עד 22:00. <a href="election-day.html">מדיטציה לדרך לקלפי</a>'
            : now < AFTER_END
              ? 'הקלפיות נסגרו. היום שאחרי: נושמים יחד, בלי קשר לתוצאות.'
              : 'תודה שהייתם נוֹכְחִים.';
        }
        return;
      }
      var mins = Math.floor(left / 60000);
      parts.d.textContent = Math.floor(mins / 1440);
      parts.h.textContent = Math.floor((mins % 1440) / 60);
      parts.m.textContent = mins % 60;
    };
    tick();
    countdownTimer = setInterval(tick, 30000);
  });

  // "Send on WhatsApp": data-share-wa="<meditation id>" shares that meditation's
  // section on the meditations page; data-share-wa="#anchor" shares this page.
  function shareLinks() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-share-wa]"), function (a) {
      var v = a.getAttribute("data-share-wa");
      var med = window.MEDITATIONS && window.MEDITATIONS[v];
      var url = med ? new URL("meditations.html#" + v, location.href).href : location.href.split("#")[0] + v;
      var title = med ? med.title : document.title;
      a.href = "https://wa.me/?text=" + encodeURIComponent(title + ": רגע של נשימה לפני הבחירות.\n" + url);
      a.target = "_blank";
      a.rel = "noopener";
      if (!a.dataset.bound) {
        a.dataset.bound = "1";
        a.addEventListener("click", function () { window.countEvent("share-whatsapp-" + (med ? v : "page")); });
      }
    });
  }
  window.onPage(shareLinks);
  window.onPage.rerunShare = shareLinks;  // for content added later (teacher meditations)

  // Hero video strip (design-v0 §7): a pre-rendered ping-pong loop, no sound.
  // Skipped (poster image only) for reduced motion, data saver or slow connections.
  window.onPage(function heroVideo() {
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
        var label = paused ? "להפעיל תנועה" : "לעצור תנועה";
        motionBtn.setAttribute("aria-label", label);
        motionBtn.title = label;
      });
    }
  });

  document.addEventListener("DOMContentLoaded", runInits);
})();
