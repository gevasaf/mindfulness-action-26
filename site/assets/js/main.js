// Shared behaviour for every page (site v0.2):
//   - window.onPage(fn): page set-up that runs on load and after every in-place navigation;
//   - in-place navigation: site links swap <main> instead of reloading, so the
//     meditation player (player.js, outside <main>) keeps playing across pages.
//     Without JS, or if a fetch fails, links are ordinary page loads;
//   - one breathing circle on screen (logo or hero), mobile menu, countdown, WhatsApp share links, hero video, motion pause.
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

  // ---------- breathing: one clock, one circle on screen (v1.1.13, v1.1.14) ----------
  // Every breathing circle reads the same clock (Date.now() modulo 10 s), so they never drift apart.
  // Each circle has a weight w (0 = resting, 1 = breathing) that eases over 1 s whenever it is turned
  // on or off, so nothing jumps: the circle moves between its resting state (half-way between its
  // smallest and largest size, echo hidden) and wherever the breath is at that moment.
  // The home page's circle breathes while motion is on; the logo breathes only while that circle
  // is out of view, so there is always exactly one breath on screen. With reduced motion, or after
  // "לעצור תנועה" (kept for the visit), everything rests.
  var CYCLE = 10000, FADE = 1000;
  var brand = document.querySelector(".brand");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var motionStopped = false;
  try { motionStopped = sessionStorage.getItem("motion-stopped") === "1"; } catch (e) {}
  var heroWrap = null, heroBreathVisible = false, heroObserver = null, raf = 0;
  function ease(x) { return (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, x)))) / 2; }
  function lerp(a, b, w) { return a + (b - a) * w; }
  // A weight that eases from where it is to a new target over FADE ms.
  function weight() { return { from: 0, to: 0, t0: 0, value: function (now) { return lerp(this.from, this.to, ease((now - this.t0) / FADE)); } }; }
  var heroW = weight(), logoW = weight();
  function aim(w, target, now) { if (w.to === target) return; w.from = w.value(now); w.to = target; w.t0 = now; }
  function breathAt(now) {
    var p = (Date.now() % CYCLE) / CYCLE;                       // the shared clock, 0..1
    var b = p < .5 ? ease(p / .5) : ease(2 - p / .5);         // in-breath 0→1, out-breath 1→0
    var e = p < .5 ? ease(p / .5) : 1;                         // the echo grows on the in-breath only
    var la = p < .45 ? 1 : p < .5 ? 1 - ease((p - .45) / .05) : p < .95 ? 0 : ease((p - .95) / .05);
    return { b: b, e: e, la: la };
  }
  function frame() {
    raf = 0;
    var now = performance.now(), s = breathAt(now);
    var wh = heroW.value(now), wl = logoW.value(now);
    if (heroWrap) {
      heroWrap.style.setProperty("--bs", lerp(1.01, .72 + .58 * s.b, wh).toFixed(4));
      heroWrap.style.setProperty("--es", lerp(1.01, .72 + 1.03 * s.e, wh).toFixed(4));
      heroWrap.style.setProperty("--eo", lerp(0, .5 * (1 - s.e), wh).toFixed(4));
      heroWrap.style.setProperty("--la", lerp(1, s.la, wh).toFixed(4));
      heroWrap.style.setProperty("--lb", lerp(0, 1 - s.la, wh).toFixed(4));
    }
    if (brand) {
      brand.style.setProperty("--ms", lerp(1.175, 1 + .35 * s.b, wl).toFixed(4));
      brand.style.setProperty("--es", lerp(1.175, 1 + .5 * s.e, wl).toFixed(4));
      brand.style.setProperty("--eo", lerp(0, .5 * (1 - s.e), wl).toFixed(4));
      brand.classList.toggle("looping", logoW.to === 1);
    }
    var settled = now - heroW.t0 >= FADE && now - logoW.t0 >= FADE && heroW.to === 0 && logoW.to === 0;
    if (!settled) raf = requestAnimationFrame(frame);
  }
  function updateBreath() {
    var now = performance.now(), on = !reduceMotion && !motionStopped;
    aim(heroW, on && heroWrap ? 1 : 0, now);
    aim(logoW, on && !heroBreathVisible ? 1 : 0, now);
    if (!raf) raf = requestAnimationFrame(frame);
  }
  window.setMotionStopped = function (on) {
    motionStopped = on;
    try { sessionStorage.setItem("motion-stopped", on ? "1" : "0"); } catch (e) {}
    updateBreath();
  };
  window.isMotionStopped = function () { return motionStopped; };
  function watchHeroBreath() {
    if (heroObserver) { heroObserver.disconnect(); heroObserver = null; }
    heroWrap = document.querySelector(".breath-wrap");
    heroBreathVisible = !!heroWrap;
    heroW = weight();                       // a new hero (in-place navigation) starts resting
    if (heroWrap && "IntersectionObserver" in window) {
      heroObserver = new IntersectionObserver(function (entries) {
        heroBreathVisible = entries[entries.length - 1].isIntersecting;
        updateBreath();
      });
      heroObserver.observe(heroWrap);
    }
    updateBreath();
  }

  // ---------- memorial candle, 7–8 October (Israel time) ----------
  // A quiet line under the header on every page, only on these two days (or with ?memorial to preview).
  // Outside <main>, so it stays through in-place navigation.
  (function memorial() {
    var day = "";
    try { day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date()); } catch (e) {}
    if (!/^2026-10-0[78]$/.test(day) && !/[?&]memorial\b/.test(location.search)) return;
    // Closed with its X: stays closed for the rest of that day on this device.
    var key = "memorial-closed-" + day;
    try { if (localStorage.getItem(key)) return; } catch (e) {}
    var header = document.querySelector(".site-header");
    if (!header) return;
    var el = document.createElement("aside");
    el.className = "memorial";
    el.setAttribute("aria-label", "נר זיכרון");
    el.innerHTML =
      '<svg class="candle" viewBox="0 0 24 32" aria-hidden="true" focusable="false">' +
        '<path class="flame" d="M12 2c2.6 3.4 4 5.8 4 8a4 4 0 0 1-8 0c0-2.2 1.4-4.6 4-8z"/>' +
        '<rect class="wick" x="11.4" y="13" width="1.2" height="3" rx=".6"/>' +
        '<rect class="body" x="7" y="16" width="10" height="14" rx="1.5"/>' +
      "</svg>" +
      "<p>שלוש שנים ל-7 באוקטובר. זוכרים את כל מי שאיבדנו, ומחזיקים בלב את מי שעדיין נושאים את היום הזה. " +
      '<a href="#support">אם עלה משהו קשה</a></p>' +
      '<button type="button" class="memorial-close" aria-label="סגירה" title="סגירה">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4L12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/></svg>' +
      "</button>";
    header.insertAdjacentElement("afterend", el);
    el.querySelector(".memorial-close").addEventListener("click", function () {
      try { localStorage.setItem(key, "1"); } catch (e) {}
      el.remove();
    });
  })();

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

  // A target inside a closed <details> (the kit's parts) needs its parts opened first.
  function openParents(el) {
    for (var d = el; d; d = d.parentElement) if (d.tagName === "DETAILS") d.open = true;
  }
  window.openParents = openParents;

  function scrollToTarget(hash) {
    var el = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    // pushState doesn't update :target, so mark the target with a class too
    Array.prototype.forEach.call(document.querySelectorAll(".is-target"), function (x) { x.classList.remove("is-target"); });
    if (el) { openParents(el); el.classList.add("is-target"); el.scrollIntoView(); } else window.scrollTo(0, 0);
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
  window.onPage(function shareLinks() {
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
  });

  // Circle kit (v1.1): "copy" buttons for the group name, description, invitation and post;
  // anonymous counts on downloads (data-count="<event>"); the site's own address in the texts.
  window.onPage(function kitTools() {
    if (/^https?:$/.test(location.protocol)) {
      var site = new URL("./", location.href).href.replace(/^https?:\/\//, "").replace(/\/$/, "");
      Array.prototype.forEach.call(document.querySelectorAll("[data-site-url]"), function (el) { el.textContent = site; });
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-count]"), function (a) {
      if (a.dataset.bound) return;
      a.dataset.bound = "1";
      a.addEventListener("click", function () { window.countEvent(a.getAttribute("data-count")); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      var label = btn.textContent;
      btn.addEventListener("click", function () {
        var src = document.getElementById(btn.getAttribute("data-copy"));
        if (!src) return;
        var text = src.innerText.trim();
        var done = function () {
          btn.textContent = "הועתק ✓";
          setTimeout(function () { btn.textContent = label; }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { selectText(src); });
        } else selectText(src);
        window.countEvent("kit-copy-" + btn.getAttribute("data-copy"));
      });
    });
    // Foldable parts: "open all" / "close all", open the part a link points to, everything open for print.
    var parts = document.querySelectorAll("details.part");
    var toggleAll = document.querySelector("[data-parts-toggle]");
    if (parts.length) {
      var syncToggle = function () {
        if (!toggleAll) return;
        var allOpen = Array.prototype.every.call(parts, function (d) { return d.open; });
        toggleAll.textContent = allOpen ? "לסגור הכול" : "לפתוח הכול";
      };
      Array.prototype.forEach.call(parts, function (d) { d.addEventListener("toggle", syncToggle); });
      if (toggleAll && !toggleAll.dataset.bound) {
        toggleAll.dataset.bound = "1";
        toggleAll.addEventListener("click", function () {
          var open = toggleAll.textContent === "לפתוח הכול";
          Array.prototype.forEach.call(document.querySelectorAll("details.part"), function (d) { d.open = open; });
        });
      }
      if (location.hash) {
        var t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (t && t.closest("details")) { openParents(t); t.scrollIntoView(); }
      }
      Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (a) {
        if (a.dataset.boundHash) return;
        a.dataset.boundHash = "1";
        a.addEventListener("click", function () {
          var t = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
          if (t) openParents(t);
        });
      });
      syncToggle();
    }

    // No clipboard access: select the text so it can be copied by hand.
    function selectText(el) {
      var r = document.createRange(); r.selectNodeContents(el);
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }
  });

  // Hero video strip (design-v0 §7): a pre-rendered ping-pong loop, no sound.
  // Skipped (poster image only) for reduced motion, data saver or slow connections.
  window.onPage(function heroVideo() {
    var video = document.querySelector("[data-hero-video]");
    var conn = navigator.connection || {};
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var slow = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "");
    var startVideo = function () {
      if (!video || reduce || slow || video.currentSrc) return;
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
    };
    if (!window.isMotionStopped()) startVideo();
    // Pause / resume the hero's slow motion (design-v0 §7: visible stop button).
    // The choice holds for the visit (sessionStorage) and also stops the logo's breath.
    var motionBtn = document.querySelector(".motion-toggle");
    var hero = document.querySelector(".hero");
    if (motionBtn && hero) {
      var setPaused = function (paused) {
        hero.classList.toggle("paused", paused);
        if (video && video.currentSrc) { if (paused) video.pause(); else { var q = video.play(); if (q && q.catch) q.catch(function () {}); } }
        else if (!paused) startVideo();
        var label = paused ? "להפעיל תנועה" : "לעצור תנועה";
        motionBtn.setAttribute("aria-label", label);
        motionBtn.title = label;
      };
      if (window.isMotionStopped()) setPaused(true);
      motionBtn.addEventListener("click", function () {
        var paused = !hero.classList.contains("paused");
        setPaused(paused);
        window.setMotionStopped(paused);
      });
    }
    watchHeroBreath();
  });

  // Contact form (About): sent to Web3Forms, which emails the founder. Nothing is stored on the site.
  // Without JS the form posts directly and Web3Forms shows its own confirmation page.
  window.onPage(function contactForm() {
    var form = document.querySelector("[data-contact-form]");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";
    var status = form.querySelector(".form-status");
    var btn = form.querySelector('button[type="submit"]');
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!window.fetch) { form.submit(); return; }
      status.className = "form-status"; status.textContent = "שולחים…";
      btn.disabled = true;
      fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) { return r.json().then(function (d) { return r.ok && d.success; }); })
        .then(function (ok) {
          if (!ok) throw new Error("send");
          form.reset();
          status.className = "form-status ok";
          status.textContent = "תודה, ההודעה נשלחה.";
          window.countEvent("contact-sent");
        })
        .catch(function () {
          status.className = "form-status err";
          status.textContent = "משהו לא הצליח. אפשר לנסות שוב בעוד רגע.";
        })
        .then(function () { btn.disabled = false; });
    });
  });

  // Print shows every folded part.
  window.addEventListener("beforeprint", function () {
    Array.prototype.forEach.call(document.querySelectorAll("details.part"), function (d) { d.open = true; });
  });

  document.addEventListener("DOMContentLoaded", runInits);
})();
