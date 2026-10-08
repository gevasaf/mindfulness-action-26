// Service worker: lets the site open without a connection (the breath, the pages, the plan form).
// Pages are network-first, so a change on the site shows at once when online; other files are served
// from the cache and refreshed in the background. Audio and video are never cached (large, range
// requests): the meditations need a connection. Nothing here is sent anywhere. See tech/design-doc.md.
var CACHE = "nochechim-1";
var CORE = [
  "./", "meditations.html", "plan.html", "election-day.html", "about.html", "404.html",
  "styles.css", "assets/js/main.js", "assets/js/plan.js", "assets/js/player.js",
  "assets/icon.svg", "assets/icons/icon-192.png", "manifest.webmanifest",
  "assets/fonts/assistant-hebrew-400-normal.woff2", "assets/fonts/assistant-hebrew-600-normal.woff2",
  "assets/fonts/assistant-hebrew-700-normal.woff2", "assets/fonts/frank-ruhl-libre-hebrew-500-normal.woff2",
  "assets/fonts/frank-ruhl-libre-hebrew-700-normal.woff2", "assets/fonts/m-plus-rounded-1c-hebrew-700-normal.woff2"
];

self.addEventListener("install", function (e) {
  // One file failing (a flaky network) must not stop the rest from being stored
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function store(req, res) {
  if (res && res.ok && !res.redirected && res.type === "basic") {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
  }
  return res;
}

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (/\/(audio|video)\//.test(url.pathname) || req.headers.has("range")) return;

  var isPage = req.mode === "navigate" || /(\.html|\/)$/.test(url.pathname);
  if (isPage) {
    // Stored without the query (?utm_source=…), so any link to the page finds it offline
    var key = url.origin + url.pathname;
    e.respondWith(fetch(req).then(function (res) { return store(key, res); }).catch(function () {
      return caches.match(key).then(function (hit) { return hit || caches.match(new URL("./", location.href).href); });
    }));
    return;
  }

  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) { return store(req, res); });
    if (hit) { net.catch(function () {}); return hit; }
    // Not stored at this exact address (a new ?v=): the network, else any stored version of the file
    return net.catch(function () { return caches.match(req, { ignoreSearch: true }); });
  }));
});
