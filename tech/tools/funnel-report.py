"""Funnel report from GoatCounter: where visitors move on, and where they stop.

Usage (from the repo root):  python3 tech/tools/funnel-report.py [START [END]]
Dates are YYYY-MM-DD (default: 2026-10-07 to today). Needs a read-only GoatCounter API key in the
environment variable GOATCOUNTER_TOKEN, and network access to goatcounter.com. Only aggregate counts
are read: GoatCounter holds no personal data, and neither does this report.

The funnel (design doc, "מסע המבקר"): visit → start a meditation → hear it to the end → make a voting
plan → share or invite → people arriving from those shares → a circle in the making (the circle
invitation, reading the kit page, the kit PDF, printing the sign or the guide).
Event names come from site/assets/js (countEvent / countAction); see tech/design-doc.md.
Written against the GoatCounter API v0 (https://www.goatcounter.com/help/api); if a field name has
changed, the script says what it got instead of guessing."""
import json, os, re, sys, time, urllib.parse, urllib.request
from collections import defaultdict
from datetime import date

SITE = os.environ.get("GOATCOUNTER_SITE", "mindfulness-action-26")
TOKEN = os.environ.get("GOATCOUNTER_TOKEN")
START = sys.argv[1] if len(sys.argv) > 1 else "2026-10-07"
END = sys.argv[2] if len(sys.argv) > 2 else date.today().isoformat()
MEDS = ["imagine-good", "my-community", "clarity-in-the-noise", "arrive-present", "behind-the-curtain"]
if not TOKEN:
    sys.exit("GOATCOUNTER_TOKEN is not set (a read-only API key from GoatCounter → Settings → API).")

def api(path, **params):
    url = f"https://{SITE}.goatcounter.com/api/v0/{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(2 ** attempt); continue   # rate limit: back off
            sys.exit(f"GoatCounter API {path}: HTTP {e.code} {e.read()[:300]!r}")
    sys.exit(f"GoatCounter API {path}: still rate-limited")

# Every path and event with its count in the period (paged: the API returns ~100 at a time).
counts, seen = defaultdict(int), []
while True:
    page = api("stats/hits", start=START, end=END, limit=100, **({"exclude_paths": ",".join(map(str, seen))} if seen else {}))
    hits = page.get("hits")
    if hits is None: sys.exit(f"Unexpected response from stats/hits: {list(page)}")
    for h in hits:
        n = h.get("count", h.get("count_unique"))
        if n is None: sys.exit(f"No count field in a hit: {sorted(h)}")
        counts[h["path"].lstrip("/") if h.get("event") else h["path"]] += n
        seen.append(h["path_id"])
    if not page.get("more") or not hits: break

def c(name): return counts.get(name, 0)
def total(rx): return sum(n for p, n in counts.items() if re.fullmatch(rx, p))

# Arrivals from shared links: the plan's share and invite links carry utm_source, which GoatCounter
# records as the referrer ("campaign"). Read from the top referrers; 0 if the endpoint differs.
refs = {}
try:
    for r in api("stats/toprefs", start=START, end=END, limit=50).get("stats", []):
        refs[r.get("name", "")] = r.get("count", 0)
except SystemExit as e:
    print(f"(referrers not read: {e})")

pages = total(r"/.*")
# (name, count, index of the step it is a share of). The circle steps hang off the visits: people
# reach the circles page from the plan, from the end of a meditation, from the menu or from the home page.
steps = [
    ("ביקורים (צפיות בעמודים)", pages, None),
    ("התחילו מדיטציה", total(r"listen-(?!complete-).*"), 0),
    ("האזינו עד הסוף", total(r"listen-complete-.*"), 1),
    ("הכינו תוכנית הצבעה", c("plan-created"), 2),
    ("שיתפו או הזמינו", c("plan-whatsapp") + c("plan-image") + c("plan-invite"), 3),
    ("הגיעו מקישור ששותף", refs.get("plan-share", 0) + refs.get("plan-invite", 0), 4),
    ("עברו לעמוד המעגלים", c("/host-kit.html"), 0),
    ("קראו את הערכה או הורידו", c("kit-read") + c("kit-pdf"), 6),
    ("הדפיסו שלט או דף הנחיה", c("sign-print") + c("sign-print-group") + c("guide-print"), 7),
]
print(f"משפך נוֹכְחִים, {START} עד {END}\n")
for name, n, base in steps:
    b = steps[base][1] if base is not None else 0
    rate = f"{100 * n / b:5.1f}% מ\"{steps[base][0]}\"" if b else ""
    print(f"{n:7d}  {name:28} {rate}")
print("\nהגעה לעמוד המעגלים: מהתוכנית", c("circle-from-plan"), "· מסוף מדיטציה", c("circle-from-player"),
      "· קריאת ערכה", c("kit-read"), "· PDF", c("kit-pdf"))
print("כניסות מהשלט (QR):", refs.get("sign", 0), "· ממייל למורים:", refs.get("teacher-email", 0), "· מהודעות:", refs.get("dm", 0))

print("\nלפי מדיטציה: התחלות · סיום · % סיום · תוכניות אחרי · מעגל/ערכה אחרי")
for m in MEDS:
    s, f = c(f"listen-{m}"), c(f"listen-complete-{m}")
    plans = c(f"plan-created-after-{m}")
    circle = sum(c(f"{a}-after-{m}") for a in ("circle-from-player", "kit-read", "kit-pdf", "sign-print", "guide-print"))
    print(f"{m:22} {s:6d} {f:6d} {(100 * f / s if s else 0):6.1f}% {plans:6d} {circle:6d}")
print("\nמספרים קטנים הם רעש: עד כמה עשרות בכל שלב, קוראים מגמות, לא אחוזים.")
