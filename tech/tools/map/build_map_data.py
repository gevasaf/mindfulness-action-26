"""Build the static map data for the circles map (design-v2 §9, stack F8).

Runs in GitHub Actions (.github/workflows/map-data.yml), which has open
internet access; the build sandbox does not. Outputs, under site/assets/map/:

  localities.json  The full CBS list of localities (data.gov.il), with OSM
                   coordinates where a match is found: [{"id": CBS code,
                   "name": Hebrew name, "lat": .., "lon": ..}]. The official
                   list is the list of places where citizens who vote live
                   (design-v2 §9); every entry is kept, also without
                   coordinates (then the "far from locality" warning is skipped).
  land.json        Natural Earth 10 m land, clipped to the map rectangle,
                   simplified and buffered ~300 m so beach lawns count as land.
                   Used only to block pins in the sea; it has no borders.

The vector tiles (region.pmtiles) are extracted by the workflow itself with
the pmtiles CLI. Coordinates are WGS84.
"""
import difflib, io, json, os, re, sys, time, unicodedata, urllib.parse, urllib.request, zipfile

BBOX = (34.15, 29.40, 35.95, 33.40)  # west, south, east, north: a plain rectangle, not a border
OUT = "site/assets/map/"
UA = {"User-Agent": "nochechim-map-data (github.com/gevasaf/mindfulness-action-26)"}


def get(url, data=None, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 - retry anything, report the last error
            print(f"  retry {i + 1}/{tries} {url[:80]}: {e}", file=sys.stderr)
            time.sleep(5 * (i + 1))
    raise SystemExit(f"failed: {url}")


def norm(name):
    """Compare Hebrew names loosely: no niqqud, no punctuation, single spaces."""
    s = "".join(c for c in unicodedata.normalize("NFD", name or "") if not unicodedata.combining(c))
    for ch in "-–־\"'״׳()`’":
        s = s.replace(ch, " ")
    return " ".join(s.split())


def cbs_localities():
    # "רשימת יישובים" (CBS codes and names) on data.gov.il
    rid = "5c78e9fa-c2e2-4771-93ff-7f400a12f7ba"
    url = f"https://data.gov.il/api/3/action/datastore_search?resource_id={rid}&limit=5000"
    recs = json.loads(get(url))["result"]["records"]
    out = []
    for r in recs:
        code = str(r.get("סמל_ישוב", "")).strip()
        name = str(r.get("שם_ישוב", "")).strip()
        if code and name and code != "0" and "לא רשום" not in name:
            out.append({"id": int(code), "name": " ".join(name.split())})
    print(f"CBS localities: {len(out)}")
    return out


def osm_places():
    w, s, e, n = BBOX
    q = f"""[out:json][timeout:180];
    (nwr["place"~"^(city|town|village|hamlet|isolated_dwelling|neighbourhood|suburb|locality)$"]({s},{w},{n},{e}););
    out tags center;"""
    data = get("https://overpass-api.de/api/interpreter", data=urllib.parse.urlencode({"data": q}).encode())
    els = json.loads(data)["elements"]
    by = {}
    rank = {"city": 0, "town": 1, "village": 2, "hamlet": 3, "suburb": 4, "neighbourhood": 5, "isolated_dwelling": 6, "locality": 7}
    for el in els:
        t = el.get("tags", {})
        for key in ("name:he", "name", "old_name:he", "alt_name:he"):
            nm = t.get(key)
            if not nm:
                continue
            for part in nm.split(";"):
                k = norm(part)
                lat = el.get("lat", el.get("center", {}).get("lat"))
                lon = el.get("lon", el.get("center", {}).get("lon"))
                if lat is None:
                    continue
                cand = (rank.get(t.get("place"), 9), lat, lon)
                if k and (k not in by or cand < by[k]):
                    by[k] = cand
    print(f"OSM places with names: {len(by)}")
    return by


def localities():
    cbs, osm = cbs_localities(), osm_places()
    keys = list(osm)
    out, how = [], {"exact": 0, "no_parens": 0, "fuzzy": 0, "none": 0}
    missing = []
    for loc in cbs:
        n = norm(loc["name"])
        hit, kind = osm.get(n), "exact"
        if not hit:  # "בן שמן (מושב)" -> "בן שמן", "אבו קרינאת (יישוב)" -> "אבו קרינאת"
            n2 = norm(re.sub(r"\(.*?\)", " ", loc["name"]))
            hit, kind = osm.get(n2), "no_parens"
            if not hit and len(n2) >= 4:
                close = difflib.get_close_matches(n2, keys, n=1, cutoff=0.88)
                hit, kind = (osm[close[0]], "fuzzy") if close else (None, "none")
        how[kind] += 1
        entry = {"id": loc["id"], "name": loc["name"]}
        if hit:
            entry.update(lat=round(hit[1], 5), lon=round(hit[2], 5))
        else:
            missing.append(loc["name"])
        out.append(entry)
    out.sort(key=lambda x: x["name"])
    print("matching:", how)
    with open(OUT + "localities.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    with open("tech/tools/map/localities-missing.txt", "w", encoding="utf-8") as f:
        f.write("# CBS localities with no coordinates found (kept in the list, no distance check)\n" + "\n".join(missing) + "\n")


def land():
    from shapely.geometry import box, mapping, shape
    from shapely.ops import unary_union
    raw = get("https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip")
    zf = zipfile.ZipFile(io.BytesIO(raw))
    zf.extractall("/tmp/ne_land")
    import shapefile  # pyshp
    shp = shapefile.Reader("/tmp/ne_land/ne_10m_land.shp")
    clip = box(*BBOX)
    parts = [shape(s.__geo_interface__).intersection(clip) for s in shp.shapes()]
    geom = unary_union([p for p in parts if not p.is_empty])
    geom = geom.buffer(0.003).simplify(0.0015)  # ~300 m lenient, ~150 m tolerance
    polys = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)
    rings = [[[round(x, 4), round(y, 4)] for x, y in p.exterior.coords] for p in polys if p.area > 1e-5]
    with open(OUT + "land.json", "w") as f:
        json.dump({"bbox": BBOX, "rings": rings}, f, separators=(",", ":"))
    print(f"land: {len(rings)} rings, {sum(len(r) for r in rings)} points")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    what = sys.argv[1:] or ["localities", "land"]
    if "land" in what:
        land()
    if "localities" in what:
        localities()
