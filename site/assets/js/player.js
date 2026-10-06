// Meditation player for design-v0.
// With data-audio: plays the pre-rendered recording (ElevenLabs voice + quiet music,
// mixed in the repo) and shows each stanza as it is spoken, from data-timings.
// Without it: reads the script aloud with the browser's own Hebrew voice (Web Speech
// API) over a pad generated with Web Audio. See tech/design-doc.md ("Meditations").
//
// Script conventions (design/releases/design-v0-meditations/README.md):
//   [שקט X שניות]  -> X seconds of silence (music continues)
//   blank line      -> short natural pause, 2 to 3 seconds
//   pace            -> very slow, about half of normal speech
(function () {
  var players = document.querySelectorAll("[data-meditation], [data-audio]");
  if (!players.length) return;

  var synth = window.speechSynthesis;
  var RATE = 0.72;
  var BLANK_PAUSE = 2.5;
  var SECONDS_PER_CHAR = 0.11; // rough estimate at RATE, for the progress bar only
  var active = null;

  // ---------- script parsing ----------
  function parse(md) {
    var lines = md.replace(/\r/g, "").split("\n");
    var start = lines.indexOf("---");
    lines = start >= 0 ? lines.slice(start + 1) : lines;
    var steps = [];
    var silence = /^\[שקט\s+(\d+(?:\.\d+)?)\s+שניות\]$/;
    lines.forEach(function (raw) {
      var line = raw.trim();
      var m = line.match(silence);
      var last = steps[steps.length - 1];
      if (m) {
        var secs = parseFloat(m[1]);
        if (last && last.pause) last.pause = Math.max(last.pause, secs); // explicit silence replaces a blank-line pause
        else steps.push({ pause: secs });
      } else if (!line) {
        if (last && !last.pause) steps.push({ pause: BLANK_PAUSE });
      } else {
        steps.push({ text: line });
      }
    });
    while (steps.length && steps[steps.length - 1].pause) steps.pop();
    steps.forEach(function (s) { s.est = s.pause || Math.max(1.5, s.text.length * SECONDS_PER_CHAR); });
    return steps;
  }

  // ---------- voice ----------
  function hebrewVoice() {
    if (!synth) return null;
    var voices = synth.getVoices().filter(function (v) { return /^(he|iw)(-|_|$)/i.test(v.lang); });
    if (!voices.length) return null;
    var local = voices.filter(function (v) { return v.localService; });
    return (local[0] || voices[0]);
  }

  // ---------- background music (generated, no file, no licence question) ----------
  function Pad() {
    this.ctx = null; this.master = null; this.nodes = [];
  }
  Pad.prototype.start = function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) this.ctx = new AC();
    var ctx = this.ctx;
    if (ctx.state === "suspended") ctx.resume();
    if (this.master) return;
    var master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 4);
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 900;
    filter.connect(master); master.connect(ctx.destination);
    var self = this;
    // D, A, E, F# : an open, unresolved, calm chord
    [146.83, 220.0, 329.63, 369.99, 293.66].forEach(function (f, i) {
      var osc = ctx.createOscillator();
      osc.type = "sine"; osc.frequency.value = f;
      osc.detune.value = (i % 2 ? 4 : -4);
      var g = ctx.createGain(); g.gain.value = 0.18;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.023; // slow swell, breath-like
      var lfoGain = ctx.createGain(); lfoGain.gain.value = 0.12;
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      osc.connect(g); g.connect(filter);
      osc.start(); lfo.start();
      self.nodes.push(osc, lfo);
    });
    this.master = master;
  };
  Pad.prototype.stop = function () {
    if (!this.master) return;
    var ctx = this.ctx, master = this.master, nodes = this.nodes;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
    setTimeout(function () { nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); master.disconnect(); }, 2200);
    this.master = null; this.nodes = [];
  };

  // ---------- player ----------
  function Player(root) {
    this.root = root;
    this.src = root.getAttribute("data-meditation");
    this.steps = null;
    this.i = 0;
    this.state = "idle"; // idle | playing | paused | done
    this.gen = 0;
    this.timer = null;
    this.pad = new Pad();
    this.build();
    this.load().catch(function () {}); // small text file; fills the "read the script" panel
  }

  Player.prototype.build = function () {
    var ui = this.root.querySelector("[data-player-ui]");
    ui.innerHTML =
      '<div class="player-controls">' +
        '<button type="button" class="btn" data-act="play">▶ להאזנה</button>' +
        '<button type="button" class="btn secondary" data-act="stop" hidden>לעצור ולהתחיל מחדש</button>' +
        '<label class="check"><input type="checkbox" data-act="music" checked> מוזיקת רקע</label>' +
      '</div>' +
      '<div class="player-progress" aria-hidden="true"><span></span></div>' +
      '<p class="player-line" aria-live="polite" data-line>מוכנים? אפשר לעצור בכל רגע.</p>' +
      '<p class="player-note" data-note></p>';
    this.btnPlay = ui.querySelector("[data-act=play]");
    this.btnStop = ui.querySelector("[data-act=stop]");
    this.musicBox = ui.querySelector("[data-act=music]");
    this.lineEl = ui.querySelector("[data-line]");
    this.noteEl = ui.querySelector("[data-note]");
    this.bar = ui.querySelector(".player-progress span");
    var self = this;
    this.btnPlay.addEventListener("click", function () { self.toggle(); });
    this.btnStop.addEventListener("click", function () { self.reset(); });
    this.musicBox.addEventListener("change", function () {
      if (self.musicBox.checked && self.state === "playing") self.pad.start(); else self.pad.stop();
    });
    if (!synth) this.note("בדפדפן הזה אין הקראה קולית. אפשר להמשיך בהקראה שקטה: המילים יופיעו כאן בקצב המדיטציה, עם המוזיקה.", true);
  };

  Player.prototype.note = function (txt, warn) {
    this.noteEl.textContent = txt || "";
    this.noteEl.classList.toggle("warn", !!warn);
  };

  Player.prototype.load = function () {
    var self = this;
    if (this.steps) return Promise.resolve(this.steps);
    return fetch(this.src).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (md) {
      self.steps = parse(md);
      self.total = self.steps.reduce(function (a, s) { return a + s.est; }, 0);
      var body = self.root.querySelector("[data-script-body]");
      if (body) body.textContent = self.steps.filter(function (s) { return s.text; }).map(function (s) { return s.text; }).join("\n");
      return self.steps;
    });
  };

  Player.prototype.toggle = function () {
    if (this.state === "playing") return this.pause();
    if (active && active !== this) active.pause();
    active = this;
    var self = this;
    this.waitVoices().then(function () { self.start(); });
  };

  // Chrome fills the voice list asynchronously; wait briefly for it on first use.
  Player.prototype.waitVoices = function () {
    if (!synth || synth.getVoices().length) return Promise.resolve();
    return new Promise(function (res) {
      synth.addEventListener("voiceschanged", res, { once: true });
      setTimeout(res, 1000);
    });
  };

  Player.prototype.start = function () {
    this.voice = hebrewVoice();
    if (synth && !this.voice) this.note("לא נמצא קול עברי בדפדפן או במכשיר הזה, ולכן ההקראה שקטה: המילים יופיעו כאן בקצב המדיטציה, עם המוזיקה.", true);
    var self = this;
    this.load().then(function () {
      if (self.state === "idle" || self.state === "done") window.countEvent("listen-" + self.src.replace(/^.*\/|\.md$/g, ""));
      if (self.state === "done") self.i = 0;
      self.state = "playing";
      self.btnPlay.textContent = "❚❚ השהיה";
      self.btnStop.hidden = false;
      if (self.musicBox.checked) self.pad.start();
      self.next();
    }).catch(function () {
      self.note("לא הצלחנו לטעון את התסריט. אפשר לנסות שוב.", true);
    });
  };

  Player.prototype.pause = function () {
    this.state = "paused";
    this.gen++;
    clearTimeout(this.timer);
    if (synth) synth.cancel();
    this.pad.stop();
    this.btnPlay.textContent = "▶ להמשיך";
    this.lineEl.classList.add("pause");
    this.lineEl.textContent = "בהשהיה. אפשר לחזור לנשימה.";
  };

  Player.prototype.reset = function () {
    this.pause();
    this.state = "idle";
    this.i = 0;
    this.btnPlay.textContent = "▶ להאזנה";
    this.btnStop.hidden = true;
    this.lineEl.textContent = "מוכנים? אפשר לעצור בכל רגע.";
    this.progress();
  };

  Player.prototype.progress = function () {
    if (!this.steps) return;
    var done = 0;
    for (var k = 0; k < this.i && k < this.steps.length; k++) done += this.steps[k].est;
    this.bar.style.width = Math.min(100, (done / this.total) * 100) + "%";
  };

  Player.prototype.next = function () {
    var self = this, gen = ++this.gen;
    this.progress();
    if (this.i >= this.steps.length) return this.finish();
    var step = this.steps[this.i];
    var advance = function () {
      if (gen !== self.gen || self.state !== "playing") return;
      self.i++;
      self.next();
    };
    if (step.pause) {
      this.lineEl.classList.add("pause");
      this.lineEl.textContent = "· · ·";
      this.timer = setTimeout(advance, step.pause * 1000);
      return;
    }
    this.lineEl.classList.remove("pause");
    this.lineEl.textContent = step.text;
    if (synth && this.voice) {
      var u = new SpeechSynthesisUtterance(step.text);
      u.lang = this.voice.lang; u.voice = this.voice; u.rate = RATE; u.pitch = 1; u.volume = 1;
      u.onend = function () { self.timer = setTimeout(advance, 400); };
      u.onerror = function () { self.timer = setTimeout(advance, 400); };
      synth.speak(u);
    } else {
      this.timer = setTimeout(advance, step.est * 1000);
    }
  };

  Player.prototype.finish = function () {
    if (this.state !== "done") window.countEvent("listen-complete-" + this.src.replace(/^.*\/|\.md$/g, ""));
    this.state = "done";
    this.pad.stop();
    this.btnPlay.textContent = "▶ להאזין שוב";
    this.lineEl.classList.add("pause");
    this.lineEl.textContent = "סוף המדיטציה. ואם עלה משהו קשה, קווי הסיוע נמצאים בתחתית העמוד.";
    this.bar.style.width = "100%";
  };

  if (synth) synth.getVoices(); // prime the voice list
  window.addEventListener("pagehide", function () { if (synth) synth.cancel(); });

  // ---------- recorded audio player ----------
  function fmt(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ":" + (t % 60 < 10 ? "0" : "") + (t % 60); }

  function AudioPlayer(root) {
    var self = this;
    this.root = root;
    this.name = root.getAttribute("data-audio").replace(/^.*\/|\.mp3$/g, "");
    this.stanzas = [];
    this.started = false;
    var ui = root.querySelector("[data-player-ui]");
    ui.innerHTML =
      '<div class="player-controls">' +
        '<button type="button" class="btn" data-act="play">▶ להאזנה</button>' +
        '<button type="button" class="btn secondary" data-act="restart" hidden>להתחיל מחדש</button>' +
        '<span class="player-time" data-time></span>' +
      '</div>' +
      '<input type="range" class="player-seek" min="0" max="100" step="1" value="0" aria-label="מיקום בהקלטה">' +
      '<p class="player-line pause" aria-live="polite" data-line>מוכנים? אפשר לעצור בכל רגע.</p>';
    this.audio = new Audio();
    this.audio.preload = "metadata";
    this.audio.src = root.getAttribute("data-audio");
    this.btnPlay = ui.querySelector("[data-act=play]");
    this.btnRestart = ui.querySelector("[data-act=restart]");
    this.seek = ui.querySelector(".player-seek");
    this.timeEl = ui.querySelector("[data-time]");
    this.lineEl = ui.querySelector("[data-line]");
    this.btnPlay.addEventListener("click", function () { self.toggle(); });
    this.btnRestart.addEventListener("click", function () { self.audio.currentTime = 0; self.audio.play(); });
    this.seek.addEventListener("input", function () {
      if (self.audio.duration) self.audio.currentTime = self.seek.value / 100 * self.audio.duration;
    });
    var a = this.audio;
    a.addEventListener("loadedmetadata", function () { self.tick(); });
    a.addEventListener("timeupdate", function () { self.tick(); });
    a.addEventListener("play", function () {
      if (active && active !== self) active.pause();
      active = self;
      if (!self.started) { self.started = true; window.countEvent("listen-" + self.name); }
      self.btnPlay.textContent = "❚❚ השהיה";
      self.btnRestart.hidden = false;
    });
    a.addEventListener("pause", function () {
      if (a.ended) return;
      self.btnPlay.textContent = "▶ להמשיך";
      self.lineEl.classList.add("pause");
      self.lineEl.textContent = "בהשהיה. אפשר לחזור לנשימה.";
    });
    a.addEventListener("ended", function () {
      window.countEvent("listen-complete-" + self.name);
      self.started = false;
      self.btnPlay.textContent = "▶ להאזין שוב";
      self.lineEl.classList.add("pause");
      self.lineEl.textContent = "סוף המדיטציה. ואם עלה משהו קשה, קווי הסיוע נמצאים בתחתית העמוד.";
    });
    a.addEventListener("error", function () {
      self.lineEl.textContent = "לא הצלחנו לטעון את ההקלטה. אפשר לנסות שוב, או לקרוא את התסריט.";
    });
    fetch(root.getAttribute("data-timings")).then(function (r) { return r.json(); }).then(function (j) {
      self.stanzas = j.stanzas || [];
      var body = root.querySelector("[data-script-body]");
      if (body) body.textContent = self.stanzas.map(function (s) { return s.text; }).join("\n\n");
    }).catch(function () {});
  }
  AudioPlayer.prototype.toggle = function () {
    if (this.audio.paused) { var p = this.audio.play(); if (p && p.catch) p.catch(function () {}); }
    else this.audio.pause();
  };
  AudioPlayer.prototype.pause = function () { this.audio.pause(); };
  AudioPlayer.prototype.tick = function () {
    var a = this.audio, t = a.currentTime, d = a.duration || 0;
    this.timeEl.textContent = fmt(t) + " / " + fmt(d);
    if (d) this.seek.value = Math.round(t / d * 100);
    if (a.paused) return;
    var cur = null;
    for (var i = 0; i < this.stanzas.length; i++) {
      if (t >= this.stanzas[i].start - 0.2 && t <= this.stanzas[i].end + 0.6) { cur = this.stanzas[i]; break; }
    }
    var text = cur ? cur.text : "· · ·";
    if (this.lineEl.textContent !== text) {
      this.lineEl.textContent = text;
      this.lineEl.classList.toggle("pause", !cur);
    }
  };

  Array.prototype.forEach.call(players, function (el) {
    if (el.hasAttribute("data-audio")) new AudioPlayer(el); else new Player(el);
  });
})();
