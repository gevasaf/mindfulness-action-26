# Technical design doc

**Implements:** `design/releases/design-v2.html` (design-v2: teachers and circles, with a server), **in progress** on branch `claude/dreamy-volta-a7p8uy`, not live yet. Live: design-v1, site v1.0.13, approved by the user 2026-10-06.
**Tech doc version:** t3.0 · **Site version:** v2.0.0 on the branch (goes live once the backend is set up: [`backend-setup.md`](backend-setup.md))
**Stack:** see [`stack.md`](stack.md)

## Overview
design-v1 is the public launch, with everything that works as a static site: home page with the new "the idea" section, the three meditations (computer voice, labelled "קול ממוחשב (AI)"), the voting plan, election day, About (Assaf Geva, a private volunteer; no nonprofit, no donations) and the detailed host kit with its printable sign and guide. The draft banner, the "דוגמה" / "בקרוב" labels and the removed pages (circles list, daily journey, day after, donate, Great Silence) are gone. Everything marked v2 in the release (teacher uploads, circles map, phone verification) is not built and does not appear on the site. The site v0.2 to v0.2.7 changes are adopted by the release as built (§8).

### design-v2 (in progress)
The community features of design-v2 §9, on a backend next to the static site (stack F4–F9, approved by the user): **teachers upload meditations** (phone code, automatic checks, AI rating, the founder approves every one), and **practice circles** (phone code, opened without manual approval after server-side sanity checks, a quiet map and a schedule, "לתאם בוואטסאפ" straight to whoever opened the circle, reports, election day as the peak). Everything that needs the server is marked `data-backend` and stays hidden until `site/assets/js/config.js` points at it, so the live v1 site is unaffected until the switch. All of it is built and tested locally (database tests, a local stand-in for the Supabase APIs, browser runs of every flow); what's left is the user's account setup (`backend-setup.md`), a test against the real services, and the merge.

## Information architecture
Flat, static pages in `site/`, one shared header (brand + nav) and footer (support lines + neutrality line).

| File | Page | Release § |
|---|---|---|
| `index.html` | Home: hero (its play button starts the central meditation), "the idea" (`#idea`, with a healing paragraph and an "עוד על המיזם" link, v1.0.7), two ways (listen, plan). The voting-plan teaser and the short about section were removed in v1.0.7 (user request) | §8 "home page structure", §10 "הרעיון" |
| `meditations.html` | Three meditations, labelled "קול ממוחשב (AI)" | §8, §9 "בעמוד המדיטציות", §10 |
| `plan.html` | Voting plan; dedications include "לארץ הזאת" | §8, §10 "הקדשות" |
| `host-kit.html` | "לפתוח מעגל" (v1.0.4; was "ערכת מארח/ת"; file name kept so links still work): detailed kit (release `design-v1-content/host-kit.md`), see A7 | §8, §10 "ערכת מארח/ת מפורטת" |
| `election-day.html` | 27.10: morning circles (with a link to the host kit), "on the way" meditation, polling-place link | §8, §10 "עמוד יום הבחירות" |
| `about.html` | Who's behind it (Assaf Geva, GitHub link), what we do, what we're not, transparency, credits | §10 "מי אנחנו", §14 |
| `sign.html` | Printable A4 sign (v1.0.4): headline "לפני שבוחרים, נושמים", "מעגל נשימה לקראת הבחירות לכנסת · 27.10", when/where lines to fill in, QR to the site | §10 host kit "חומרים" |
| `host-guide.html` | Printable one-page guide; mirrors `host-kit.html` (keep them in step, v1.0.11): 30-minute flow, rules, roles, safety, election day, support lines | §10 host kit "חומרים" |
| `circles.html` | **(design-v2)** Practice circles: election-day counter, filters (locality, day), map and schedule views, circle cards | §9 ב, ג |
| `circle.html?id=` | **(design-v2)** One circle: its card, a small map, "למחוק את המעגל" (phone code for the same number). The link people share | §9 ב, ג |
| `open-circle.html` | **(design-v2)** Open a circle: when (election day first), where (locality from the list + a pin on the map), texts, consents, phone code; "המעגלים שלי" | §9 ב |
| `teachers.html` | **(design-v2)** For teachers: the `teachers.md` text and the upload form | §9 א |
| `privacy.html` | **(design-v2)** What is collected, who sees what, which services, when it's deleted (build's text, A11) | §9 "פרטיות", §14 |
| `admin.html` | **(design-v2)** The founder's review page: recordings (both versions, transcript, AI rating, approve/reject, tags, remove) and circles (reports, hide/show, delete). `noindex`, not linked | §9, §14 |
| `404.html` | Not-found page (GitHub Pages serves it for any missing path, e.g. old links to removed pages), `noindex` | build choice |

Removed in site v1.0 (design-v1 §8): `circles.html`, `journey.html`, `day-after.html`, `donate.html`.

Anchors on the home page: `#idea`, `#ways`, `#circles` (design-v2); `#support` on every page.

## Backend (design-v2)
| Part | Where | What it does |
|---|---|---|
| Database | `supabase/migrations/…_circles_and_teachers.sql` | Tables with row-level security on and no policies: the browser reaches data only through functions that never return phone numbers. Circle checks (dates until 27.10, 06:00–21:30 on the quarter hour, 07:00 on election day, the map rectangle, not in the sea, near the locality as a warning, no links or phone numbers, duplicates, 2 new circles per number per day), reports (3 separate reporters hide a circle), the WhatsApp link built only on request, teacher submissions, admin functions (`is_admin()` by phone), `purge_personal_data()`. Storage buckets `submissions` (private; each user writes only to their own folder; the founder can read) and `media` (public) |
| Map data | `supabase/migrations/…_map_data.sql` (generated by `tech/tools/supabase/make_seed.py`) | The CBS list of localities (all 1,316; 1,229 with coordinates) and the land outline |
| Edge functions | `supabase/functions/create-circle`, `report-circle` | create-circle: verified phone session → the database checks → a Claude Opus 5.5 text check (party or candidate names, voting advice, us-vs-them, offensive words, promotion; structured output, low effort, server-side fallback) → save. If the AI check can't run, the circle goes up marked `needs_review` (A13). report-circle: Turnstile + salted hash of the IP |
| Recordings worker | `tech/recordings-worker/process_submissions.py`, `.github/workflows/recordings-worker.yml` | Every 10 minutes: length check (3–15 min), the published version (mono 80 kbps; the site's music bed if asked, via the shared `tech/tools/meditation_mix.py`), ElevenLabs Scribe transcript, Claude rating (relevance, violations quoted, suggested tags, summary); publishes what the founder approved; from 30.11.2026 deletes personal data and sign-in accounts |
| Front end | `site/assets/js/backend.js`, `map.js`, `circles.js`, `teachers.js`, `admin.js`, `config.js` | `backend.js`: Supabase client, phone sign-in (one sign-in for every page, kept in this browser so the same phone gets no new SMS; "מחובר/ת עם … · להתנתק"), Turnstile, Hebrew messages, dates, calendar files. `map.js`: MapLibre + PMTiles (`assets/map/region.pmtiles`, zoom ≤ 13) with the Protomaps style recoloured to the palette, **without boundaries, country names or region names**, text-only labels, Hebrew with the local name (RTL plugin, Noto Sans glyphs for Latin, Hebrew, Arabic, Greek, Cyrillic). Vendored: maplibre-gl 5.24, pmtiles 4.5, @protomaps/basemaps 5.7, mapbox-gl-rtl-text 0.3, supabase-js 2.117 |
| Map data build | `.github/workflows/map-data.yml`, `tech/tools/map/build_map_data.py` | Runs in Actions (the build sandbox can't reach the sources): Protomaps extract of the rectangle, CBS localities joined with OSM coordinates, Natural Earth land (buffered ~300 m) |
| Tests | `tech/tools/supabase/test.sh` (50 checks), `tech/tools/supabase/mock_server.py` | Database rules on plain Postgres; a local stand-in for the Supabase APIs for browser runs of every flow |

Player: teacher recordings are registered at runtime (`window.registerMeditation`) with their own URL; they have no captions and no "קול ממוחשב (AI)" label. Measurement adds `circle-open`, `circle-whatsapp`, `circle-calendar`, `circle-share`, `circle-report`, `meditation-upload` (§14).

## Visual system
- **Colors** (CSS custom properties in `site/styles.css`): `--paper #f7f3ec`, `--ink #2b2925`, `--sage #6f8a72`, `--clay #b9684a`, `--sage-soft #e6ece4`, `--clay-soft`, plus the release's dark-mode set under `prefers-color-scheme: dark`. Darker `--sage-ink` / `--clay-ink` variants are used for text and button fills so they meet WCAG AA contrast.
- **Brand name** (site v1.0.1, user request): written with niqqud, "נוֹכְחִים", in **M PLUS Rounded 1c** 700 (Google Fonts, SIL OFL), self-hosted Hebrew subset (`assets/fonts/m-plus-rounded-1c-hebrew-700-normal.woff2`, 5 KB, preloaded; licence `OFL-MPLUSRounded1c.txt`), via `--brand-font`. Used in the header, the plan card, the plan PNG and the printable sign. **Since v1.0.6 (user request) it is also the titles font:** h1–h3 everywhere (printables included), the player's meditation titles and the title on the plan PNG, with a Latin subset (`m-plus-rounded-1c-latin-700-normal.woff2`, 22 KB) for digits and punctuation in headings. Body text stays Assistant; Frank Ruhl Libre remains for the countdown digits, captions and plan-card values. **Every "נוכחים" on the site is written with niqqud, "נוֹכְחִים"** (HTML, page titles, meta, JS strings such as share texts); the meditation script files in `site/content/meditations/*.md` stay verbatim copies of the release.
- **Type:** Frank Ruhl Libre (headings, 500/700) and Assistant (body, 400/600/700), **self-hosted** woff2 (Hebrew + Latin subsets, ~140 KB total, SIL OFL, licences in `site/assets/fonts/`). Chosen over Google Fonts so the site makes no third-party requests.
- **Breathing circle:** CSS animation, 5 s in / 5 s out, with "שאיפה / נשיפה" labels. Since v1.0.2 a white echo circle (`.breath-echo`) sits behind it: on the in-breath it grows past the circle (scale .72 → 1.75) while fading from 50% opacity to 0, then waits through the out-breath. Paused by the stop-motion button, hidden under reduced motion.
- **Logo breath (v1.0.2):** hovering, focusing or touching (phones, v1.0.5) the logo runs one breath of the header circle (10 s, scale 1 → 1.35 → 1) with the same white echo (scale 1 → 1.5, fading 50% → 0). `main.js` adds `.breathing` to `.brand` and removes it on `animationend`, so the loop always completes and can run again. The circle's fill is `::after` and the echo `::before`, so the echo stays behind and centred. Off under reduced motion.
- **Hero video strip:** Pexels clip "Golden wheat field swaying in the breeze" by †reny aleksa (credited in the hero). Colour muted toward sand/sage (the source is saturated yellow-orange, which §7 avoids). The clip doesn't loop, so it is pre-rendered as a ping-pong (forward, then reversed) whose speed eases to zero at each turn over 1.8 s: 30 s loop, 960×540, WebM VP9 + MP4 H.264, ~2 MB each, in `site/assets/video/`. A poster still shows first; the video loads only without reduced motion, data saver or 2G. The motion button (wavy-lines icon, slashed when paused, v1.0.8) pauses it. The gradient stays underneath as a fallback.
- **Labels:** only `.tag-tts` "קול ממוחשב (AI)" remains (on every computer-voiced recording, and in the player). The "בקרוב" / "דוגמה" tags and the draft banner were removed in site v1.0.

## Content
- **Who "we" is (site v1.0.3, user decision):** the project is one volunteer, so the site doesn't speak as an organizational "we".
  - **Keep "we" = all of us** (the neutrality rule's meaning): "ארבע שנים עברו עלינו", "רבים מאיתנו", "לחיים שלנו".
  - **Organizational statements use the Hebrew impersonal or the site/project as subject:** "כאן לא אומרים בעד מי להצביע, ולא שואלים", "האתר סופר ביקורים", "האתר אינו מהווה טיפול או תחליף לטיפול מקצועי..." (formal wording, v1.0.12), "נוכחים הוא לא מפלגה...".
  - **Exception (v1.0.13, user decision):** the neutrality promise speaks directly, in "we": "אנחנו לא אומרים לכם למי להצביע, ולעולם לא נשאל אתכם למי תצביעו." (footer on every page, the sign, the guide's footer).
  - **Statements of belief may keep "אנחנו מאמינים"** (an invitation the reader can share).
  - **A circle host's own "we"** (the WhatsApp templates, the opening words, the sign's "לשבת איתנו") stays: there it means the people in the circle.
  - **The founder speaks in the first person in one place only:** a short note on the About page (v1.0.9: the user's own wording, unsigned) explaining that "we" means everyone who lives here.
  - The meditation scripts' "ואפילו אותנו" stays (it is in the recordings).
- **No "host" (site v1.0.4, user decision):** a circle isn't hosting guests, so "מארח/ת" is gone. The person who starts a circle "פותח/ת מעגל" (the release's own audience term); the page is "לפתוח מעגל" and the kit "ערכה לפתיחת מעגל". Roles inside the circle stay "מנחה/ה" and "מלווה".
  - The nav item and page title "מי אנחנו" became "על המיזם"; the home page section is "מי מאחורי זה".
- Page copy is hand-written HTML in `site/*.html`, taken from the release text. Header, footer (with the version line) and support section are identical on every page; the HTML files are the source, so when editing them, change all seven pages (including `404.html`) (`sign.html` and `host-guide.html` are standalone). Bump the version in every footer and in the printables' sheet footers, **and in the `?v=` cache-busting query on every `styles.css`, `print.css` (including its `@import`) and `assets/js/*.js` reference.** GitHub Pages lets browsers cache CSS/JS for about 10 minutes; without the query, new HTML can meet old CSS (seen in v1.0.2: the echo element pushed the breathing circle off its label, and the logo did nothing).
- Meditation scripts are copied verbatim from `design/releases/design-v0-meditations/` to `site/content/meditations/` (the deploy only ships `site/`); the same text is embedded in each meditation's "לקריאת התסריט" panel. Recordings and stanza timings are in `site/content/meditations/audio/`, made with `tech/tools/mix-meditation-audio.py`. The hero video loop is made with `tech/tools/video-pingpong.py`.
- Sample circles, journey days and Great Silence details are placeholders marked "דוגמה" / "בקרוב".

## Interactions & features
| Feature | Implementation | Fits stack? |
|---|---|---|
| Countdown to 27.10 | `assets/js/main.js`, target 2026-10-27 07:00 Israel time (UTC+2), updates every 30 s. Afterwards the counter hides and the caption changes: 27.10 07:00–22:00 "היום יום הבחירות. הקלפיות פתוחות עד 22:00." + link to the election-day meditation; until the end of 28.10 "הקלפיות נסגרו. היום שאחרי: נושמים יחד, בלי קשר לתוצאות." (no link since v1.0: the day-after page is gone); then "תודה שהייתם נוכחים." (v0.2.2, build's wording, see question #7) | yes |
| Meditations (recordings) | Voice tracks from ElevenLabs (free tier, attributed), generated once from the release scripts. Mixed in the repo with ffmpeg: 3 s music pre-roll, voice, 6 s tail; the music bed is a soft D-A-E-F♯ pad about 19 dB under the voice, audible in the silences. Output: `site/content/meditations/audio/<id>.mp3` (mono, 80 kbps; 4.3 / 2.0 / 1.2 MB) and `<id>.json` stanza timings (silence detection; gaps of 1.5 s or more match the script's stanza breaks exactly) | yes (F1) |
| End of a meditation (v0.2.4) | No toast. When the audio ends, the support lines and an invitation to plan appear **together, at once**. Bar: the title and time are replaced by a "התוכנית שלי" button (v0.2.5) with a "קווי סיוע" link beside it; play/pause, share and close stay; playing again or seeking brings the title and time back. Full screen: under "סוף המדיטציה. לאט, לחזור לחדר, לגוף, לנשימה.", a larger primary "התוכנית שלי" button (v0.2.5) with the support-lines link below it. Both link to `plan.html` (full screen closes). The plan button is skipped if a plan was already made in this visit (in-memory flag, nothing stored) | yes |
| Global player (v0.2) | `player.js`: one `<audio>` outside `<main>`. Bottom bar fades in on play and out on close: play/pause, back 15 s, full screen, WhatsApp share of the playing meditation (v0.2.1; also in full screen from v0.2.2), close (all icons), seek bar, time, title linking to `meditations.html#<id>`. Any `[data-play="<id>"]` button starts/toggles that meditation and shows its state; pages have descriptions + buttons, no embedded players. Full-screen overlay: slow breathing gradient (palette colours, static under reduced motion), stanza captions that cross-fade, big play/pause, Escape closes. Body gets bottom padding while the bar shows so the footer is never covered | yes |
| In-place navigation (v0.2) | `main.js`: same-site `.html` links fetch the page and swap `<main>` (title, description, nav state), `pushState`/`popstate` for back/forward, focus moves to the new `h1`, GoatCounter page view sent. Page set-up runs through `window.onPage`. Falls back to a normal page load on any error or without JS. Printables (`data-no-swap`, new tab), downloads and external links are untouched | yes (no build step, no library) |
| Download / share audio file | "להורדה" links with Hebrew file names; share buttons labelled "שיתוף" with the WhatsApp icon (Simple Icons, CC0; accessible name "שיתוף בוואטסאפ") share `meditations.html#<id>` for meditations or the page anchor otherwise; host kit links the main meditation as its audio file | yes |
| Printables | `sign.html` and `host-guide.html`, A4 print CSS (`assets/print.css`), version in the sheet footer; the "טיוטה" watermark and draft notes were removed in v1.0. The sign's QR code is generated in the browser for the page's own address (`assets/js/vendor/qrcode.js`, qrcode-generator, MIT) | yes |
| Version mark | Footer line on every page: "גרסה v1.0 · date · מה השתנה" (links to this changelog), no "טיוטה" since v1.0 (design-v1 §8). Also in the printables' sheet footers | yes |
| Voting plan | `assets/js/plan.js`, all fields optional: when (slot or exact time), **where** (v0.2.3; goes only into the calendar's LOCATION, never onto the shared card or text, since a polling place reveals where someone lives), with whom, whom I invite, **whom I dedicate the moment behind the curtain to** (v0.2.3; a fixed list, not free text, so a card shared under our name can't carry a slogan: my children, my family, people close to me, in memory of those we lost, my neighbours including those who think differently, the future of all of us, myself), and a **meditation for the way** (v0.2.3; its link goes into the calendar description and URL, and the 1-hour alarm names it). No question on political views. Outputs a card, WhatsApp share text, a PNG card (grows with the number of rows), an `.ics` event (RFC 5545 line folding) with alarms 1 h and 18 h before, a link to the Central Elections Committee and an "invite someone else to plan" link. **No wa.me link in the calendar**: an encoded Hebrew WhatsApp URL is several hundred characters of %D7… in the event notes, looks broken in calendar apps and is out of place in a personal reminder; the short "#plan" invite link does the same job cleanly. Nothing stored or sent: no cookies, no localStorage, no network calls | yes |
| Background video strip | `<video>` sources added by `main.js` when motion and connection allow; poster image otherwise | yes (F2, approved) |
| Measurement (plans, listens, shares) | GoatCounter script on every page. Page views plus anonymous events from `window.countEvent` (`main.js`): `plan-created`, `plan-whatsapp`, `plan-image`, `plan-calendar`, `listen-<script>`, `listen-complete-<script>`, `share-meditation-whatsapp`. Only the event name is sent, never what people type. A footer line says so | yes (F3, approved) |

## Accessibility & performance
- `lang="he" dir="rtl"`, logical CSS properties (`inset-inline-*`, `padding-inline-*`), skip link, landmarks, one `h1` per page, `aria-current` in nav, visible focus rings, 44–48 px touch targets.
- `prefers-reduced-motion`: hero drift and breathing animation stop entirely; the stop-motion button covers everyone else.
- Player: current line in an `aria-live="polite"` region; full script readable as text; works without a voice.
- Mobile menu collapses behind a hamburger icon button (accessible name "תפריט", turns into X when open) only when JS runs; without JS the nav is a plain list.
- The only third-party request is GoatCounter's script and counter; no images other than an SVG icon, fonts preloaded; total page weight well under 300 KB.
- Verified with Playwright (Chromium) at 1280×900 and 390×844, light and dark: no console errors, no failed requests, no horizontal overflow.

## Site v0.2: user design remarks (2026-10-06)
Given directly by the user in the build chat, on top of design-v0. Adopted as built by design-v1 (§8, question #6).
1. A single player docked at the bottom, fading in on play and out on stop, that keeps playing across pages. The meditations page shows descriptions with play buttons; every play button on the site drives this player. Full screen shows a gradient animation and fading captions. Icons instead of words. Clicking the title opens that meditation on the meditations page.
2. WhatsApp links get the WhatsApp icon.
3. Draft printable sign and host guide, marked as drafts.
4. A visible version mark.
5. The hero video is less visible behind the text (stronger paper veil in the text column).

Further remarks, v0.2.1 to v0.2.7 (same status: built, waiting for design-v1):
6. Share buttons read "שיתוף"; the WhatsApp icon carries the meaning (v0.2.1).
7. The draft banner can be closed for the session (v0.2.1).
8. The mobile menu button is a hamburger icon (v0.2.1).
9. The player bar and the full-screen player have a WhatsApp share icon for the meditation playing now (v0.2.1, v0.2.2).
10. On phones, the whole hero including both buttons fits in the first screen (v0.2.2).
11. The countdown is replaced by captions on election day, the day after and later; wording by build, question #7 (v0.2.2).
12. Voting plan: location (calendar only), dedication of the moment (fixed list), meditation for the way (in the calendar); question #8 (v0.2.3).
13. The voting plan has its own page, `plan.html`, with texts rewritten around the moment behind the curtain; the home page keeps a teaser; question #9 (v0.2.4). Election day is a day off, so the copy mentions errands, not work (v0.2.6).
14. When a meditation ends, the player shows "התוכנית שלי" and the support lines together, no toast and no delay; the button is more prominent in full screen (v0.2.4, v0.2.5).
15. The home page no longer has the central-meditation box; the hero's play button starts it (v0.2.7).
16. The player's meditation name has a chevron: down elsewhere, up on the meditations page (v0.2.7).

After design-v1 (site v1.0.1, waiting for a design release, question #11):
17. The brand name has niqqud, "נוֹכְחִים", and uses M PLUS Rounded 1c.
18. The logo circle breathes once on hover; both breathing circles get a white echo that grows past them and fades out (v1.0.2).
19. "We" (v1.0.3): no organizational "we"; impersonal voice for the project, a signed first-person note from the founder on the About page, "על המיזם" instead of "מי אנחנו" (see Content).
20. No "host" (v1.0.4): "מארח/ת" becomes "לפתוח מעגל" / "ערכה לפתיחת מעגל"; the printable sign leads with "לפני שבוחרים, נושמים" and names the elections.
21. Titles in the brand font and niqqud on every "נוֹכְחִים" (v1.0.6).
22. Home page (v1.0.7): voting-plan teaser and "מי מאחורי זה" section removed; "עוד על המיזם" link under "הרעיון"; a paragraph on healing and what was pushed aside ("נדחק הצידה") added to "הרעיון".
23. The hero's motion button is an icon (v1.0.8): wavy lines for motion on, the same with a slash when paused (play/pause icons are reserved for audio). Its accessible name and tooltip read "לעצור תנועה" / "להפעיל תנועה".
24. "לפתוח מעגל" (v1.0.10): "באים בלבן" also in the invitation template; closing section asking people to post on social media and to open their own circle.
25. About, "מי עומד מאחורי זה" in the user's words: "...כיוזמה פרטית, וללא קשר לכל עמותה או מפלגה"; the first-person note is shorter and unsigned (v1.0.9).
26. The printable guide mirrors the "לפתוח מעגל" page: "אחרי המעגל: להעביר הלאה", and the closing step invites people to open their own circle (v1.0.11).
27. Formal disclaimer in the support section: "האתר אינו מהווה טיפול או תחליף לטיפול מקצועי. במידת הצורך, יש לפנות לאנשי מקצוע או לקווי הסיוע." (v1.0.12).
28. The neutrality promise speaks in "we": "אנחנו לא אומרים לכם למי להצביע, ולעולם לא נשאל אתכם למי תצביעו." (footer on every page, the sign, the guide; v1.0.13).
29. Niqqud on every "נוֹכְחִים" on the site, running text and tab titles included: confirmed by the user on 6.10, after design-v2 §7 said otherwise (see "Open against design-v2").

### Open against design-v2 (raised as questions-for-design #16; resolved, design-v2 adopted all of it)
design-v2 (updated 6.10, answers to #10–#14) adopted remarks 17–22 but contradicts or omits later user decisions. **Until design fixes the release, the v2 build keeps the live site's wording and behaviour wherever they differ (assumption A9).**

| design-v2 says | User decision (live) | Remark |
|---|---|---|
| §7: the name has niqqud only as a mark; running text and the tab title without | Niqqud on every "נוֹכְחִים" | 29 |
| §6 "we" rule: "כאן לא אומרים בעד מי להצביע, ולא שואלים"; a *signed* note on the About page | "אנחנו לא אומרים לכם למי להצביע, ולעולם לא נשאל אתכם למי תצביעו."; the note is unsigned, in the user's words | 28, 25 |
| §12: "לא טיפול. אנחנו מפנים לאנשי מקצוע ולקווי סיוע." | "האתר אינו מהווה טיפול או תחליף לטיפול מקצועי. במידת הצורך, יש לפנות לאנשי מקצוע או לקווי הסיוע." | 27 |
| §1, §10, §13 About: "כאדם פרטי ובשמו המלא. אין עמותה, אין מפלגה, אין תרומות ואין מימון" | "כיוזמה פרטית, וללא קשר לכל עמותה או מפלגה" (no funding is still stated elsewhere on the page) | 25 |
| `design-v2-content/host-kit.md`: "אנחנו מציעים לבוא בלבן" (against its own "we" rule); invitation without "בלבן"; no closing section | "מציעים לבוא בלבן"; "אם יש, אפשר לבוא בלבן." in the invitation; "אחרי המעגל: להעביר הלאה" | 19, 24 |
| (missing) | The guide mirrors the kit; the motion button is an icon | 26, 23 |

## Traceability
| Design requirement (design-v1 §) | Technical decision | Status |
|---|---|---|
| §8 no draft banner, no "דוגמה" / "בקרוב" labels; v2 features simply absent | Banner markup, CSS and JS removed; tags removed; no placeholders for v2 | done |
| §8 / §9 computer-voice label stays | "קול ממוחשב (AI)" on each meditation card, the election-day card and the player (bar and full screen) | done |
| §8 home page structure | Hero (as before) · "הרעיון" (§10 text, plus a healing paragraph and an "עוד על המיזם" link, v1.0.7) · "דרכים להיות נוכחים" with listen + plan (circles and teachers are v2) · support. Plan teaser and short about removed at the user's request (v1.0.7) | done (adapted) |
| §8 all site v0.2–v0.2.7 remarks adopted | Kept as built; version mark without "טיוטה" | done |
| §8 removed: sample circles, Great Silence, daily journey, day-after page, donations, "בקרוב" meditations | Pages deleted, home sections and nav items removed, links updated; `404.html` catches old links | done |
| §10 / §14 "לארץ הזאת" in dedications | Added to the fixed list in `plan.html` | done |
| §10 / §14 About: Assaf Geva, GitHub link, no nonprofit, no donations | `about.html` rewritten; "לא אוספים כסף" added to "what we're not"; contact via the GitHub profile (A8) | done |
| §10 detailed host kit, incl. "באים בלבן", 30-minute circle, election day as the peak | `host-kit.html` from `design-v1-content/host-kit.md`, adapted for no server (A7); sign and guide updated to match | done |
| §10 election day page unchanged; countdown wording approved (q. #7) | Only the "המחשה" tag removed and a host-kit link added | done |
| §7 visual language unchanged | No change | done |
| §5 / §13 neutrality in code and meta | All new copy, meta descriptions and the 404 page checked against the non-partisan test | done |
| §9, §14 v2 (server) features | Not built in v1; flagged (F4–F9) and approved, then built for design-v2 (below) | see below |

| Design requirement (design-v2 §) | Technical decision | Status |
|---|---|---|
| §9 א teachers page and form, consents, thank-you screen | `teachers.html` (teachers.md text, A12), `teachers.js`: photo resized in the browser, length checked before upload, files into the user's own private folder, `submit_meditation` | built, tested locally |
| §9 א background music option, same music and settings | Shared `meditation_mix.py`; worker mixes; original kept private; music sample on the form | built, tested locally |
| §9 א / §5 three layers: automatic filter, AI rating, manual approval | Storage type and size limits + length check; Claude rating; nothing public before `admin_review_submission` + worker publish | built, tested locally (AI with a real key at go-live) |
| §9 א teacher meditations on the meditations page, filter by length and setting | `list_meditations`, filters; settings tags chosen by the founder (A10) | built, tested locally |
| §9 ב open a circle: phone code, fixed 30 min, once or weekly until 27.10, 2 per number per day, no manual approval | `open-circle.html`, `create-circle`, `create_circle_as` | built, tested locally |
| §9 ב sanity checks; the interface doesn't allow out-of-range input | Only valid dates and times offered; pin checked against the rectangle and the sea in the browser; the same rules in the database | built, tested |
| §9 ב neutrality: a rectangle, not a border | `in_map_rect`; the map draws no boundary lines and no country or region names | built |
| §9 ב delete with a code to the same number | `circle.html`, `delete_my_circle`, "המעגלים שלי" | built, tested locally |
| §9 ב reports: 3 separate reports hide a circle until checked; opener not told | `report-circle` + `report_circle_as`; admin hide/show/delete | built, tested |
| §9 election day as the peak: first option, filter, own marker, counter | Featured first choice; `?day=election` filter; clay markers; `election_day_circle_count` on home and circles | built, tested locally |
| §9 ג map and schedule, filters, card, WhatsApp with a ready message, add to calendar, report, transparency note, "אין מעגל קרוב?" | `circles.html`, `circles.js`; link from `circle_whatsapp_link` on demand; `.ics` with local time zone (weekly: RRULE until 27.10) | built, tested locally |
| §9 privacy: no email, phone only; teachers' numbers never public; delete by 30.11, approved recordings stay | Functions never return phones; `purge_personal_data` + account deletion in the worker; `privacy.html` | built, tested |
| §14 map: palette, accessible, list as a full alternative | Palette style; the schedule view lists every circle; map regions labelled | built |
| §14 budget | Free tiers + SMS; spend limits in the setup guide | setup guide |
| §10 kit step 3 back, invitation and post per design-v2-content | `host-kit.html`; the guide already mirrors it | built |
| §10 "הרעיון" ends with the neutrality promise | `index.html` | built |

## Assumptions
- **A10** (design-v2, question #17): the form has no field for "בבית / בדרך / לפני השינה", so the founder sets these tags when approving (the AI suggests them); the length filter uses the measured length.
- **A11** (design-v2, question #17): `privacy.html` is written by build from design-v2 §9 and the services actually used; it needs the design chat's and a lawyer's review.
- **A12** (design-v2, question #17): `teachers.md` speaks as an organizational "we" in a few places ("אנחנו מחפשים", "נוסיף מוזיקה", "המדיטציה המרכזית שלנו"); the page uses the impersonal per the user's rule (remark 19). The thank-you screen keeps design's exact text.
- **A13** (design-v2): if the AI text check can't run (no key, outage, a decline), the circle still goes up (design: no manual approval) and is marked for the founder in admin.
- **A14** (design-v2): localities are the full CBS list; coordinates come from OpenStreetMap by name; 87 without a match stay selectable and skip the distance warning (`tech/tools/map/localities-missing.txt`).
- **A15** (design-v2): a weekly circle on Tuesdays meets on election day too, so it can't start before 07:00.
- **A1** (questions-for-design #1, answered): the draft banner wording and public deploy follow the user's answer, not the release's "internal, do not publish" text.
- **A7** (design-v1, question #10): the release's host kit has a step "לפתוח את המעגל באתר" (map, phone verification, delete), which is v2. In v1 the kit shows three steps (place, time, invite): "סימון במפה" for a private home reads "לפרסם נקודה כללית", and the invitation template ends "לתיאום: לכתוב לי בוואטסאפ" instead of a link to the circle's page. The rest of the kit is verbatim. When v2 is built the fourth step comes back.
- **A9** (resolved: design-v2 adopted all of #16): where design-v2 contradicts or omits a later user decision (remarks 23–29, table "Open against design-v2"), the build follows the user's decision and the live site.
- **A8** (design-v1): the release says removal requests reach the founder "through the contact details on the About page" but gives no contact details beyond the GitHub profile, so the About page offers contact through the GitHub profile. Waiting for the user to choose another channel if wanted.
- **A2:** the polling-place link points to the Central Elections Committee home page; the exact lookup URL for the 26th Knesset could not be verified from the build environment. Check before promoting.
- **A4** (question #3): support lines are ERAN 1201, NATAL 1-800-363-363, SAHAR (online chat), plus 101/100 for emergencies.

## Changelog
| Tech doc version | Implements | Date | Summary |
|---|---|---|---|
| t3.0 | design-v2 (in progress) | 2026-10-06 | Backend (Supabase), circles, teachers, admin, recordings worker, self-hosted map, all built and tested locally on the branch; `backend-setup.md`; A10–A15; question #17. Site v2.0.0 waits for the user's account setup. |
| t2.0.15 | design-v1 | 2026-10-06 | v1 approved by the user at site v1.0.13. Next: design-v2 (server features, flagged in stack.md before building). |
| t2.0.14 | design-v1 + user decisions | 2026-10-06 | Docs only: remarks 25–29 folded in (About wording, guide mirrors the kit, formal disclaimer, "we" neutrality promise, niqqud everywhere confirmed); new table "Open against design-v2" listing where the updated design-v2 contradicts or omits user decisions; assumption A9; questions-for-design #16. |
| t2.0.13 | design-v1 + user remark | 2026-10-06 | Site v1.0.13: the neutrality promise reads "אנחנו לא אומרים לכם למי להצביע, ולעולם לא נשאל אתכם למי תצביעו." in every footer, on the sign and in the guide. |
| t2.0.12 | design-v1 + user remark | 2026-10-06 | Site v1.0.12: the support section's disclaimer is formal: "האתר אינו מהווה טיפול או תחליף לטיפול מקצועי. במידת הצורך, יש לפנות לאנשי מקצוע או לקווי הסיוע." (every page); About's "מה זה לא" item matches. |
| t2.0.11 | design-v1 + user remark | 2026-10-06 | Site v1.0.11: the printable circle guide (`host-guide.html`) follows the "לפתוח מעגל" page: "צילום" became "אחרי המעגל: להעביר הלאה" (share on social media with the photo rule, invite participants to open their own circle), and the closing step adds the invitation to open a circle. Still one A4 page (checked by printing to PDF). Rule: any change to `host-kit.html` is mirrored in `host-guide.html` (and the sign, where relevant). |
| t2.0.10 | design-v1 + user remarks | 2026-10-06 | Site v1.0.10, "לפתוח מעגל": the invitation template adds "אם יש, אפשר לבוא בלבן."; new closing section "אחרי המעגל: להעביר הלאה" (share on social media with the photo rules, invite participants to open their own circle, a suggested post, and a WhatsApp share button for the page). |
| t2.0.9 | design-v1 + user remark | 2026-10-06 | Site v1.0.9: About, "מי עומד מאחורי זה" rewritten in the user's words (a private initiative, not connected to any nonprofit or party); the first-person note shortened and no longer signed. |
| t2.0.8 | design-v1 + user remark | 2026-10-06 | Site v1.0.8: the hero's motion on/off button is a 44 px round icon button (wavy lines; slashed when paused), with aria-label and title instead of visible text. |
| t2.0.7 | design-v1 + user remarks | 2026-10-06 | Site v1.0.7, home page: removed the voting-plan teaser (`#plan`) and the short about (`#about`); "עוד על המיזם" link under "הרעיון"; new paragraph in "הרעיון" on healing and what we pushed aside. |
| t2.0.6 | design-v1 + user remarks | 2026-10-06 | Site v1.0.6: all titles (h1–h3, player titles, plan PNG title) in M PLUS Rounded 1c, with its Latin subset added; "נוֹכְחִים" with niqqud everywhere on the site (33 places). |
| t2.0.5 | design-v1 + user remarks | 2026-10-06 | Site v1.0.5 (fix): cache-busting `?v=` on all CSS/JS references, so new HTML never runs with cached old CSS/JS (the user saw an off-centre breathing label, no echo and no logo breath after v1.0.2). The logo breath also starts on touch. |
| t2.0.4 | design-v1 + user decisions | 2026-10-06 | Site v1.0.4: "מארח/ת" replaced across the site ("לפתוח מעגל" in the nav and page title, "ערכה לפתיחת מעגל" in links, "דף הנחיה למעגל"); the sign's headline is "לפני שבוחרים, נושמים" with "מעגל נשימה לקראת הבחירות לכנסת · 27.10"; question #13. |
| t2.0.3 | design-v1 + user decision | 2026-10-06 | Site v1.0.3: who "we" is. Organizational "we" rewritten in the impersonal (footer, support lines, plan, election day, host kit, sign, guide, home); About page renamed "על המיזם" with a signed first-person note from Assaf Geva; voice rule recorded under Content; question #12. |
| t2.0.2 | design-v1 + user remarks | 2026-10-06 | Site v1.0.2: one logo breath on hover or focus; white fading echo behind the hero's breathing circle and the logo circle. |
| t2.0.1 | design-v1 + user remark | 2026-10-06 | Site v1.0.1: brand name "נוֹכְחִים" with niqqud in M PLUS Rounded 1c (self-hosted Hebrew subset), in header, plan card, plan PNG and sign; question #11. |
| t2.0 | design-v1 | 2026-10-06 | Site v1.0, public launch: draft banner and "דוגמה"/"בקרוב" labels removed; circles, journey, day-after and donate pages removed (plus home circles and Great Silence sections); "הרעיון" section on the home page; About rewritten (Assaf Geva, no nonprofit, no donations); detailed host kit, sign and host guide (30-minute circle, "באים בלבן", election day); "לארץ הזאת" dedication; "קול ממוחשב (AI)" label; 404 page. A7, A8, question #10. |
| t1.2.8 | design-v0 + user remarks | 2026-10-06 | Docs only: overview, remarks list 6–16 (v0.2.1–v0.2.7), traceability for the home page and primary actions brought up to date. |
| t1.2.7 | design-v0 + user remarks | 2026-10-06 | Site v0.2.7: home page drops the "המדיטציה המרכזית" box (the hero's play button starts it; the meditations page has the details); the player's title has a chevron (down = open the meditation's details, flips up on the meditations page). |
| t1.2.6 | design-v0 + user remarks | 2026-10-06 | Site v0.2.6: plan page copy: election day is a day off, so "בין סידורים, קניות וכל ההמולה" instead of mentioning work. |
| t1.2.5 | design-v0 + user remarks | 2026-10-06 | Site v0.2.5: player end button reads "התוכנית שלי" (accessible name "התוכנית שלי: תוכנית ההצבעה"); larger primary button in full screen. |
| t1.2.4 | design-v0 + user remarks | 2026-10-06 | Site v0.2.4: voting plan on its own page (`plan.html`, in the nav) with rewritten texts (question #9); home page teaser; end of meditation shows the plan button and support lines together, no delay; the bar's end state replaces title/time until replay or seek; player wording "לתכנן הצבעה". |
| t1.2.3 | design-v0 + user remarks | 2026-10-06 | Site v0.2.3, voting-plan funnel: location (calendar only), dedication of the moment (fixed list), meditation for the way (linked in the calendar); invite link in the calendar instead of a WhatsApp link; after a meditation ends, support lines first and a delayed, quiet invitation to plan (question #8). |
| t1.2.2 | design-v0 + user remarks | 2026-10-06 | Site v0.2.2: compact hero on phones (both buttons in the first screen, tested 360–412 px wide, banner open or closed); countdown captions for election day, the day after and later (question #7); WhatsApp share also in the full-screen player. |
| t1.2.1 | design-v0 + user remarks | 2026-10-06 | v0.2 approved. Share buttons read "שיתוף" (icon carries WhatsApp); draft banner can be closed for the session; player bar gets a WhatsApp share icon (shares the meditation playing now); mobile menu button is a hamburger icon (X when open, accessible name "תפריט"); docs refreshed; audio and video tooling committed to `tech/tools/`. |
| t1.2 | design-v0 + user remarks | 2026-10-06 | Site v0.2: global bottom player + full-screen overlay with fading captions, in-place navigation so audio continues across pages, WhatsApp icons, draft printable sign (QR) and host guide, version mark in footer, fainter hero video. Removed the browser-TTS fallback (all three meditations are recorded). |
| t1.1 | design-v0 | 2026-10-06 | Wheat-field hero video (eased ping-pong), ElevenLabs recordings with music and live captions, GoatCounter, About page. |
| t1 | design-v0 | 2026-10-06 | Full v0 prototype: 8 pages, browser TTS meditations with generated music, working voting plan, countdown, self-hosted fonts. Flags F1–F3. F1: stay on browser TTS; F2: wheat video built; F3: GoatCounter built. |
| t0 | — | 2026-10-06 | Scaffold only |
