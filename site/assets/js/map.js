// The quiet, self-hosted map for circles (design-v2 §7, §9; stack F8):
// MapLibre + PMTiles vector tiles (assets/map/region.pmtiles) styled in the
// site palette, with no border lines and no country or region names. Labels are
// Hebrew, with the local name where there is one (RTL shaping plugin).
//   SiteMap.create(el, opts) -> Promise<map>; SiteMap.inRect(lat, lon); SiteMap.km(a, b)
(function () {
  var Backend = window.Backend;
  var SiteMap = window.SiteMap = {};
  SiteMap.RECT = [[34.15, 29.40], [35.95, 33.40]];  // a plain rectangle, not a border (design-v2 §9)
  var DROP = ["boundaries", "boundaries_country", "places_country", "places_region", "pois", "roads_shields", "roads_oneway", "address_label"];
  var mapLibs = null;
  function loadMapLibs() {
    if (!mapLibs) mapLibs = Promise.all([
      Backend.css("assets/vendor/maplibre/maplibre-gl.css"),
      Backend.script("assets/vendor/maplibre/maplibre-gl.js"),
      Backend.script("assets/vendor/maplibre/pmtiles.js"),
      Backend.script("assets/vendor/maplibre/basemaps.js")
    ]).then(function () {
      var protocol = new window.pmtiles.Protocol();
      window.maplibregl.addProtocol("pmtiles", protocol.tile);
      try { window.maplibregl.setRTLTextPlugin(Backend.url("assets/vendor/maplibre/mapbox-gl-rtl-text.js"), true); } catch (e) {}
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
      glyphs: Backend.url("assets/map/fonts/") + "{fontstack}/{range}.pbf",  // placeholders must stay unencoded
      sources: { protomaps: { type: "vector", url: "pmtiles://" + Backend.url("assets/map/region.pmtiles"),
        attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>' } },
      layers: bm.layers("protomaps", f, { lang: "he" }).filter(function (l) { return DROP.indexOf(l.id) < 0; }).map(function (l) {
        // No sprite sheet: text-only labels (drops town dots and capital stars)
        if (l.layout) Object.keys(l.layout).forEach(function (k) { if (k.indexOf("icon-") === 0) delete l.layout[k]; });
        return l;
      })
    };
  }
  SiteMap.create = function (el, opts) {
    opts = opts || {};
    return loadMapLibs().then(function () {
      var map = new window.maplibregl.Map({
        container: el, style: style(), bounds: opts.bounds || SiteMap.RECT, fitBoundsOptions: { padding: 10 },
        maxBounds: [[33.6, 29.0], [36.5, 33.8]], minZoom: 6, maxZoom: 17, attributionControl: { compact: true },
        cooperativeGestures: !!opts.cooperative, dragRotate: false, pitchWithRotate: false
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "top-left");
      return new Promise(function (ok) { map.on("load", function () { ok(map); }); });
    });
  };
  SiteMap.inRect = function (lat, lon) { return lat >= 29.40 && lat <= 33.40 && lon >= 34.15 && lon <= 35.95; };
  SiteMap.km = function (a, b) {
    var R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.pow(Math.sin(dLon / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  };
})();
