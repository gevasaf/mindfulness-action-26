// Practice circles (design-v2 §9): the circles page (map + schedule), a single
// circle's page, the open-a-circle form, and the home page section.
// Data comes from the database functions (supabase/migrations); phone numbers
// never reach the page. The WhatsApp link is fetched only when someone taps
// "לתאם בוואטסאפ".
(function () {
  var V2 = window.V2;
  if (!V2) return;
  var esc = V2.esc;
  var WA_ICON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

  function circleUrl(c) { return V2.url("circle.html?id=" + c.id); }

  // ---------- a circle card ----------
  function card(c, opts) {
    opts = opts || {};
    var h = opts.heading || "h3";
    return '<article class="circle-card' + (c.election_day ? " is-election" : "") + '" data-id="' + esc(c.id) + '">' +
      '<div class="cc-head"><' + h + ' class="cc-title">' + (opts.link === false ? esc(c.title) : '<a href="circle.html?id=' + esc(c.id) + '">' + esc(c.title) + "</a>") + "</" + h + ">" +
      (c.election_day ? '<span class="tag tag-election">ביום הבחירות</span>' : "") + "</div>" +
      '<p class="cc-when">' + esc(V2.whenText(c)) + (c.kind === "weekly" && c.next_date ? ' <span class="cc-next">· הבא: ' + esc(V2.dayLabel(c.next_date)) + "</span>" : "") + "</p>" +
      '<p class="cc-where">' + esc(c.place_name) + " · " + esc(c.locality) + "</p>" +
      '<p class="cc-desc">' + esc(c.description) + "</p>" +
      (c.first_name ? '<p class="cc-host">פותח/ת את המעגל: ' + esc(c.first_name) + "</p>" : "") +
      '<div class="btn-row cc-actions">' +
        '<button type="button" class="btn" data-circle="whatsapp">' + WA_ICON + "לתאם בוואטסאפ</button>" +
        '<button type="button" class="btn secondary" data-circle="calendar">הוספה ליומן</button>' +
        '<a class="btn secondary" data-circle="share" href="https://wa.me/?text=' + encodeURIComponent("מעגל נשימה לפני הבחירות: " + c.title + "\n" + V2.whenText(c) + " · " + c.place_name + ", " + c.locality + "\n" + circleUrl(c)) + '" target="_blank" rel="noopener" aria-label="שיתוף המעגל בוואטסאפ">' + WA_ICON + "שיתוף</a>" +
      "</div>" +
      '<p class="privacy-note cc-note">ההודעה תישלח מהוואטסאפ שלך, ולכן מי שפתח/ה את המעגל יראה את המספר שלך.</p>' +
      '<p class="cc-report"><button type="button" class="linkish" data-circle="report">לדווח על המעגל</button></p>' +
    "</article>";
  }

  // Card buttons (delegated: cards are re-rendered on filtering)
  var byId = {};
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-circle]") : null;
    if (!b) return;
    var el = b.closest(".circle-card"), c = el && byId[el.getAttribute("data-id")];
    if (!c) return;
    var act = b.getAttribute("data-circle");
    if (act === "whatsapp") {
      e.preventDefault();
      // Open the window first (popup blockers), then point it at the link.
      var w = window.open("", "_blank");
      V2.rpc("circle_whatsapp_link", { p_id: c.id }).then(function (link) {
        window.countEvent("circle-whatsapp");
        if (!link) { if (w) w.close(); alert("המעגל כבר לא פעיל."); return; }
        if (w) { w.opener = null; w.location = link; } else location.href = link;
      }).catch(function () { if (w) w.close(); alert("לא הצלחנו לפתוח את וואטסאפ. אפשר לנסות שוב."); });
    } else if (act === "calendar") {
      window.countEvent("circle-calendar");
      V2.download(V2.circleIcs(c, circleUrl(c)), "מעגל-נשימה.ics");
    } else if (act === "share") {
      window.countEvent("circle-share");
    } else if (act === "report") {
      openReport(c);
    }
  });

  // ---------- report dialog ----------
  var dlg = null;
  function openReport(c) {
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.className = "report-dlg";
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = '<form method="dialog" class="report-form">' +
      "<h2>לדווח על המעגל</h2>" +
      '<p>הדיווח מגיע ליוזם. מעגל שמקבל כמה דיווחים נפרדים מוסתר עד שהוא נבדק. מי שפתח/ה את המעגל לא מקבל/ת הודעה.</p>' +
      '<div class="field"><label for="rp-reason">מה הבעיה? <span class="hint">לא חובה</span></label><textarea id="rp-reason" maxlength="300" rows="3"></textarea></div>' +
      '<div class="rp-captcha"></div><p class="form-msg" role="status" aria-live="polite"></p>' +
      '<div class="btn-row"><button type="button" class="btn" data-rp="send">לשלוח דיווח</button><button type="button" class="btn secondary" data-rp="close">ביטול</button></div>' +
      "</form>";
    var captcha = V2.turnstile(dlg.querySelector(".rp-captcha"));
    var msg = dlg.querySelector(".form-msg");
    dlg.onclick = function (e) {
      var b = e.target.closest("[data-rp]");
      if (!b) return;
      if (b.getAttribute("data-rp") === "close") { dlg.close(); return; }
      b.disabled = true; msg.textContent = "שולחים...";
      captcha.then(function (t) {
        return V2.fn("report-circle", { id: c.id, reason: dlg.querySelector("#rp-reason").value, captchaToken: t.token() });
      }).then(function (r) {
        b.disabled = false;
        if (r && r.ok) {
          window.countEvent("circle-report");
          dlg.querySelector(".report-form").innerHTML = "<h2>תודה</h2><p>הדיווח הגיע ליוזם.</p>" +
            '<div class="btn-row"><button type="button" class="btn" data-rp="close">סגירה</button></div>';
        } else { msg.textContent = V2.msg(r); captcha.then(function (t) { t.reset(); }); }
      }).catch(function () { b.disabled = false; msg.textContent = V2.msg(null); });
    };
    dlg.showModal();
  }

  // ---------- map markers ----------
  function geojson(list) {
    return { type: "FeatureCollection", features: list.map(function (c) {
      return { type: "Feature", properties: { id: c.id, election: !!c.election_day }, geometry: { type: "Point", coordinates: [c.lon, c.lat] } };
    }) };
  }
  function addCircleLayer(map, list, onPick) {
    map.addSource("circles", { type: "geojson", data: geojson(list) });
    map.addLayer({ id: "circles-halo", type: "circle", source: "circles",
      paint: { "circle-radius": 11, "circle-color": ["case", ["get", "election"], "#b9684a", "#6f8a72"], "circle-opacity": 0.22 } });
    map.addLayer({ id: "circles-dot", type: "circle", source: "circles",
      paint: { "circle-radius": 6, "circle-color": ["case", ["get", "election"], "#b9684a", "#6f8a72"],
        "circle-stroke-color": "#fffdf9", "circle-stroke-width": 2 } });
    if (onPick) {
      map.on("click", "circles-dot", function (e) { onPick(e.features[0].properties.id); });
      map.on("mouseenter", "circles-dot", function () { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "circles-dot", function () { map.getCanvas().style.cursor = ""; });
    }
  }

  // ---------- circles page ----------
  window.onPage(function circlesPage() {
    var root = document.getElementById("circles-page");
    if (!root || !V2.on) return;
    var listEl = root.querySelector("[data-list]"), mapEl = root.querySelector("[data-map]");
    var locSel = root.querySelector("#cf-locality"), daySel = root.querySelector("#cf-day");
    var all = [], map = null;

    function filtered() {
      var today = V2.today(), weekEnd = V2.addDays(today, 6), loc = locSel.value, day = daySel.value;
      return all.filter(function (c) {
        if (loc && String(c.locality_id) !== loc) return false;
        if (day === "election") return c.election_day;
        if (day === "today") return c.next_date === today;
        if (day === "week") return c.next_date <= weekEnd;
        return true;
      });
    }
    function render() {
      var list = filtered();
      root.querySelector("[data-count]").textContent = list.length ? (list.length === 1 ? "מעגל אחד" : list.length + " מעגלים") : "";
      listEl.innerHTML = list.length ? list.map(function (c) { return card(c); }).join("") :
        '<div class="empty-note"><p><b>אין מעגל קרוב?</b> אפשר לפתוח אחד.</p>' +
        '<div class="btn-row"><a class="btn" href="open-circle.html">לפתוח מעגל</a><a class="btn secondary" href="host-kit.html">לערכה לפתיחת מעגל</a></div>' +
        '<p>ובינתיים, אפשר <a href="meditations.html">להאזין למדיטציה לבד</a>.</p></div>';
      if (map && map.getSource("circles")) map.getSource("circles").setData(geojson(list));
    }
    function pick(id) {
      var el = listEl.querySelector('[data-id="' + id + '"]');
      if (!el) return;
      root.querySelector('[data-view="list"]').click();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("is-target"); setTimeout(function () { el.classList.remove("is-target"); }, 2500);
    }

    // Views: map / schedule (the list is the full alternative to the map, design-v2 §14)
    root.querySelectorAll("[data-view]").forEach(function (t) {
      t.addEventListener("click", function () {
        var v = t.getAttribute("data-view");
        root.querySelectorAll("[data-view]").forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); });
        mapEl.hidden = v !== "map";
        if (v === "map") {
          if (!map) V2.map(mapEl.querySelector(".map"), { cooperative: true }).then(function (m) { map = m; addCircleLayer(m, filtered(), pick); });
          else map.resize();
        }
      });
    });
    locSel.addEventListener("change", render);
    daySel.addEventListener("change", render);
    var q = new URLSearchParams(location.search);
    if (q.get("day")) daySel.value = q.get("day");

    V2.rpc("list_circles").then(function (list) {
      all = list || [];
      all.forEach(function (c) { byId[c.id] = c; });
      var seen = {}, opts = all.filter(function (c) { return !seen[c.locality_id] && (seen[c.locality_id] = 1); })
        .sort(function (a, b) { return a.locality.localeCompare(b.locality, "he"); });
      locSel.innerHTML = '<option value="">כל היישובים</option>' + opts.map(function (c) { return '<option value="' + c.locality_id + '">' + esc(c.locality) + "</option>"; }).join("");
      render();
    }).catch(function () { listEl.innerHTML = '<p class="form-msg bad">לא הצלחנו לטעון את המעגלים. אפשר לנסות לרענן את הדף.</p>'; });
    loadCounter();
    root.querySelector('[data-view="map"]').click();
  });

  // ---------- election day counter (home + circles page) ----------
  function loadCounter() {
    var els = document.querySelectorAll("[data-election-count]");
    if (!els.length || !V2.on) return;
    V2.rpc("election_day_circle_count").then(function (n) {
      els.forEach(function (el) {
        el.textContent = n > 0 ? (n === 1 ? "כבר מעגל אחד ביום הבחירות" : "כבר " + n + " מעגלים ביום הבחירות") : "עוד אין מעגלים ביום הבחירות. אפשר לפתוח את הראשון.";
        el.hidden = false;
      });
    }).catch(function () {});
  }

  // ---------- home page section ----------
  window.onPage(function homeCircles() {
    var root = document.getElementById("circles-home");
    if (!root || !V2.on) return;
    loadCounter();
    V2.rpc("list_circles").then(function (list) {
      list = (list || []).slice(0, 3);
      list.forEach(function (c) { byId[c.id] = c; });
      root.querySelector("[data-list]").innerHTML = list.length ? list.map(function (c) { return card(c); }).join("") :
        "<p>עוד אין מעגלים באתר. אפשר לפתוח את הראשון.</p>";
    }).catch(function () {});
  });

  // ---------- one circle (circle.html?id=...) ----------
  window.onPage(function circlePage() {
    var root = document.getElementById("circle-page");
    if (!root || !V2.on) return;
    var id = new URLSearchParams(location.search).get("id") || "";
    var box = root.querySelector("[data-circle-box]");
    V2.rpc("get_circle", { p_id: id }).then(function (c) {
      if (!c) { box.innerHTML = '<p>המעגל לא נמצא. אולי הוא כבר התקיים, או נמחק.</p><div class="btn-row"><a class="btn" href="circles.html">לכל המעגלים</a></div>'; return; }
      byId[c.id] = c;
      document.title = c.title + " · מעגל נשימה · נוֹכְחִים";
      box.innerHTML = card(c, { heading: "h2", link: false });
      var mapEl = root.querySelector(".map");
      mapEl.hidden = false;
      V2.map(mapEl, { cooperative: true, bounds: [[c.lon - 0.02, c.lat - 0.015], [c.lon + 0.02, c.lat + 0.015]] })
        .then(function (m) { addCircleLayer(m, [c]); });
      root.querySelector("[data-owner]").hidden = false;
    }).catch(function () { box.innerHTML = '<p class="form-msg bad">לא הצלחנו לטעון את המעגל.</p>'; });

    var del = root.querySelector("[data-delete]");
    del.addEventListener("click", function () {
      del.hidden = true;
      var area = root.querySelector("[data-delete-area]");
      area.hidden = false;
      V2.phoneAuth(area.querySelector("[data-auth]"), { lead: "כדי למחוק, צריך לאמת את אותו מספר טלפון שאיתו נפתח המעגל." }).then(function () {
        return V2.rpc("delete_my_circle", { p_id: id });
      }).then(function (ok) {
        area.innerHTML = ok ? "<p><b>המעגל נמחק.</b> הוא כבר לא מופיע במפה ובלו\"ז.</p>" :
          '<p class="form-msg bad">המספר שאומת לא תואם למספר שאיתו נפתח המעגל.</p>';
      }).catch(function () { area.insertAdjacentHTML("beforeend", '<p class="form-msg bad">' + V2.msg(null) + "</p>"); });
    });
  });

  // ---------- open a circle ----------
  var land = null;
  function onLand(lat, lon) {
    if (!land) return true;
    var inside = false;
    land.rings.forEach(function (ring) {
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
      }
    });
    return inside;
  }
  function timeOptions(from) {
    var out = [];
    for (var m = 6 * 60; m <= 21 * 60 + 30; m += 15) {
      var t = ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + m % 60).slice(-2);
      if (!from || t >= from) out.push(t);
    }
    return out;
  }

  window.onPage(function openCircle() {
    var form = document.getElementById("open-circle-form");
    if (!form || !V2.on) return;
    var f = form.elements, state = { lat: null, lon: null, loc: null };
    var msg = form.querySelector("[data-form-msg]");
    function say(t, bad) { msg.textContent = t || ""; msg.classList.toggle("bad", !!bad); if (t) msg.scrollIntoView({ block: "nearest" }); }
    fetch(V2.url("assets/map/land.json")).then(function (r) { return r.json(); }).then(function (j) { land = j; }).catch(function () {});

    // When: only valid dates and times are offered (design-v2 §9)
    function fillTimes(sel, from) {
      var cur = sel.value;
      sel.innerHTML = timeOptions(from).map(function (t) { return "<option>" + t + "</option>"; }).join("");
      if (cur && Array.prototype.some.call(sel.options, function (o) { return o.value === cur; })) sel.value = cur;
    }
    function refreshWhen() {
      var kind = (form.querySelector("input[name=when]:checked") || {}).value;
      form.querySelectorAll("[data-when]").forEach(function (el) { el.hidden = el.getAttribute("data-when") !== kind; });
      var today = V2.today(), now = V2.nowTime();
      var nextQuarter = function () { var p = now.split(":"); var m = +p[0] * 60 + +p[1] + 15 - ((+p[1]) % 15); return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + m % 60).slice(-2); };
      if (kind === "election") fillTimes(f.election_time, today === V2.ELECTION ? (nextQuarter() > "07:00" ? nextQuarter() : "07:00") : "07:00");
      if (kind === "once") fillTimes(f.once_time, f.once_date.value === today ? nextQuarter() : null);
      if (kind === "weekly") fillTimes(f.weekly_time, +f.weekday.value === V2.weekday(V2.ELECTION) ? "07:00" : null);
    }
    (function fillDates() {
      var today = V2.today(), opts = [];
      for (var d = today; d < V2.ELECTION; d = V2.addDays(d, 1)) opts.push('<option value="' + d + '">' + V2.dayLabel(d) + "</option>");
      f.once_date.innerHTML = opts.join("");
      if (!opts.length) form.querySelector('[data-when-choice="once"]').hidden = true;
      if (today > V2.ELECTION) form.innerHTML = "<p>יום הבחירות עבר. תודה שהייתם נוֹכְחִים.</p>";
      f.weekday.innerHTML = V2.DAYS.map(function (n, i) { return '<option value="' + i + '">יום ' + n + "</option>"; }).join("");
      f.weekday.value = String((V2.weekday(today) + 1) % 7);
    })();
    form.addEventListener("change", function (e) {
      if (["when", "once_date", "weekday"].indexOf(e.target.name) >= 0) refreshWhen();
    });
    refreshWhen();

    // Where: locality from the list, pin on the map
    var marker = null, map = null;
    V2.localities().then(function (list) {
      state.list = list;
      form.querySelector("#oc-localities").innerHTML = list.map(function (l) { return '<option value="' + esc(l.name) + '">'; }).join("");
    });
    function setLocality() {
      var name = f.locality.value.trim();
      state.loc = (state.list || []).filter(function (l) { return l.name === name; })[0] || null;
      f.locality.setCustomValidity(state.loc || !name ? "" : "לבחור יישוב מהרשימה");
      if (state.loc && state.loc.lat != null && map && state.lat == null) map.flyTo({ center: [state.loc.lon, state.loc.lat], zoom: 13.5 });
    }
    f.locality.addEventListener("change", setLocality);
    f.locality.addEventListener("input", setLocality);
    V2.map(form.querySelector(".map"), {}).then(function (m) {
      map = m;
      m.on("click", function (e) { setPin(e.lngLat.lat, e.lngLat.lng); });
    });
    function setPin(lat, lon) {
      var note = form.querySelector("[data-pin-note]");
      if (!V2.inRect(lat, lon)) { note.textContent = V2.msg({ error: "outside_map" }); note.classList.add("bad"); return; }
      if (!onLand(lat, lon)) { note.textContent = V2.msg({ error: "in_sea" }); note.classList.add("bad"); return; }
      state.lat = +lat.toFixed(5); state.lon = +lon.toFixed(5);
      if (!marker) {
        marker = new window.maplibregl.Marker({ color: "#6f8a72", draggable: true }).setLngLat([lon, lat]).addTo(map);
        marker.on("dragend", function () { var p = marker.getLngLat(); setPin(p.lat, p.lng); });
      } else marker.setLngLat([lon, lat]);
      note.textContent = "המקום סומן. אפשר לגרור את הסימון כדי לדייק.";
      note.classList.remove("bad");
      form.querySelector("[data-far]").hidden = true;
    }

    // Text counters
    form.querySelectorAll("[data-count-for]").forEach(function (out) {
      var el = f[out.getAttribute("data-count-for")];
      var upd = function () { out.textContent = el.value.length + "/" + el.maxLength; };
      el.addEventListener("input", upd); upd();
    });

    function payload() {
      var kind = (form.querySelector("input[name=when]:checked") || {}).value;
      var p = {
        title: f.title.value.trim(), description: f.description.value.trim(), place_name: f.place_name.value.trim(),
        first_name: f.first_name.value.trim(), locality_id: state.loc && state.loc.id, lat: state.lat, lon: state.lon,
        confirm_far: f.confirm_far.checked,
        consents: { public_place: f.c_public.checked, rules: f.c_rules.checked, responsible: f.c_responsible.checked,
                    phone_visible: f.c_phone.checked, adult: f.c_adult.checked }
      };
      if (kind === "election") { p.kind = "once"; p.on_date = V2.ELECTION; p.start_time = f.election_time.value; }
      else if (kind === "once") { p.kind = "once"; p.on_date = f.once_date.value; p.start_time = f.once_time.value; }
      else { p.kind = "weekly"; p.weekday = +f.weekday.value; p.start_time = f.weekly_time.value; }
      return p;
    }
    function localCheck(p) {
      if (!state.loc) return { error: "locality" };
      if (state.lat == null) return { error: "pin" };
      if (p.title.length < 3) return { error: "title_length" };
      if (p.description.length < 3) return { error: "description_length" };
      if (p.place_name.length < 2) return { error: "place_length" };
      var c = p.consents;
      if (!(c.public_place && c.rules && c.responsible && c.phone_visible && c.adult)) return { error: "consents" };
      if (state.loc.lat != null && !p.confirm_far && V2.km(state.loc, state) > 8) return { ok: false, error: "far_from_locality", locality: state.loc.name };
      return null;
    }
    function showError(r) {
      if (r.error === "far_from_locality") {
        var far = form.querySelector("[data-far]");
        far.hidden = false;
        far.querySelector("span").textContent = V2.msg(r);
        far.scrollIntoView({ block: "center" });
        say("");
        return;
      }
      say(r.error === "pin" ? "צריך לסמן את המקום על המפה." : V2.msg(r), true);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var p = payload(), err = localCheck(p);
      if (err) { showError(err); return; }
      say("");
      var authBox = form.querySelector("[data-auth]");
      form.querySelector("[data-continue]").hidden = true;
      authBox.hidden = false;
      V2.phoneAuth(authBox, { lead: "כמעט סיימנו: אימות קצר של מספר הטלפון שיש בו וואטסאפ." }).then(function () {
        say("פותחים את המעגל...");
        return V2.fn("create-circle", { circle: payload() });
      }).then(function (r) {
        if (!r || !r.ok) {
          form.querySelector("[data-continue]").hidden = false;
          showError(r || {});
          return;
        }
        window.countEvent("circle-open");
        var c = { id: r.id }, url = circleUrl(c), p2 = payload();
        var invite = "מוזמנים למעגל נשימה שקט לפני הבחירות 🌾\n" +
          (p2.kind === "weekly" ? "כל יום " + V2.DAYS[p2.weekday] + " ב-" + p2.start_time : V2.dayLabel(p2.on_date) + " · " + p2.start_time) + " · " + p2.place_name + "\n" +
          "חצי שעה של שקט, מדיטציה קצרה ושיתוף במילה אחת. לא צריך ניסיון.\nאם יש, אפשר לבוא בלבן.\n" +
          "אנחנו לא אומרים לכם למי להצביע, ולעולם לא נשאל אתכם למי תצביעו. רק עוצרים יחד.\nפרטים ותיאום: " + url;
        form.innerHTML = '<div class="oc-done">' +
          "<h2>המעגל עלה למפה 🌾</h2>" +
          "<p>מי שירצה להצטרף ילחץ על \"לתאם בוואטסאפ\" בעמוד המעגל, והשיחה תיפתח איתך.</p>" +
          '<div class="btn-row">' +
            '<a class="btn" href="https://wa.me/?text=' + encodeURIComponent(invite) + '" target="_blank" rel="noopener">' + WA_ICON + "להזמין בוואטסאפ</a>" +
            '<a class="btn secondary" href="circle.html?id=' + esc(r.id) + '">לעמוד המעגל</a>' +
            '<a class="btn secondary" href="sign.html" data-no-swap target="_blank">שלט להדפסה</a>' +
          "</div>" +
          '<p>הנחיה למעגל: <a href="host-kit.html">הערכה לפתיחת מעגל</a> · <a href="host-guide.html" data-no-swap target="_blank">דף הנחיה להדפסה</a>.</p>' +
          '<p class="privacy-note">כדי למחוק את המעגל: בעמוד המעגל, "למחוק את המעגל", עם קוד אימות לאותו מספר.</p>' +
        "</div>";
        form.scrollIntoView({ block: "start" });
      }).catch(function () { say(V2.msg(null), true); form.querySelector("[data-continue]").hidden = false; });
    });
  });

  // ---------- my circles (open-circle page) ----------
  window.onPage(function myCircles() {
    var root = document.getElementById("my-circles");
    if (!root || !V2.on) return;
    var btn = root.querySelector("[data-show]");
    btn.addEventListener("click", function () {
      btn.hidden = true;
      var box = root.querySelector("[data-box]");
      V2.phoneAuth(box, { lead: "המעגלים שפתחת עם המספר הזה:" }).then(function () { return V2.rpc("my_circles"); }).then(function (list) {
        box.innerHTML = list.length ? '<ul class="my-list">' + list.map(function (c) {
          return '<li><a href="circle.html?id=' + esc(c.id) + '">' + esc(c.title) + "</a> · " + esc(V2.whenText(c)) +
            (c.hidden ? ' <span class="tag">מוסתר לבדיקה</span>' : "") +
            ' <button type="button" class="linkish" data-del="' + esc(c.id) + '">למחוק</button></li>';
        }).join("") + "</ul>" : "<p>עוד לא נפתחו מעגלים מהמספר הזה.</p>";
      });
      box.addEventListener("click", function (e) {
        var b = e.target.closest("[data-del]");
        if (!b || !confirm("למחוק את המעגל? אי אפשר לבטל.")) return;
        V2.rpc("delete_my_circle", { p_id: b.getAttribute("data-del") }).then(function (ok) {
          if (ok) b.closest("li").innerHTML = "<span>המעגל נמחק.</span>";
        });
      });
    });
  });
})();
