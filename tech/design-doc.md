# Technical design doc

**Implements:** `design/releases/design-v1.html` (design-v1, released 2026-10-06: public launch, no server)
**Tech doc version:** t2.0 · **Site version:** v1.0 (shown in every page footer; waiting for the user's test and notes)
**Stack:** see [`stack.md`](stack.md)

## Overview
design-v1 is the public launch, with everything that works as a static site: home page with the new "the idea" section, the three meditations (computer voice, labelled "קול ממוחשב (AI)"), the voting plan, election day, About (Assaf Geva, a private volunteer; no nonprofit, no donations) and the detailed host kit with its printable sign and guide. The draft banner, the "דוגמה" / "בקרוב" labels and the removed pages (circles list, daily journey, day after, donate, Great Silence) are gone. Everything marked v2 in the release (teacher uploads, circles map, phone verification) is not built and does not appear on the site. The site v0.2 to v0.2.7 changes are adopted by the release as built (§8).

## Information architecture
Flat, static pages in `site/`, one shared header (brand + nav) and footer (support lines + neutrality line).

| File | Page | Release § |
|---|---|---|
| `index.html` | Home: hero (its play button starts the central meditation), "the idea" (`#idea`), two ways (listen, plan), voting-plan teaser, short about | §8 "home page structure", §10 "הרעיון" |
| `meditations.html` | Three meditations, labelled "קול ממוחשב (AI)" | §8, §9 "בעמוד המדיטציות", §10 |
| `plan.html` | Voting plan; dedications include "לארץ הזאת" | §8, §10 "הקדשות" |
| `host-kit.html` | Detailed host kit (release `design-v1-content/host-kit.md`), see A7 | §8, §10 "ערכת מארח/ת מפורטת" |
| `election-day.html` | 27.10: morning circles (with a link to the host kit), "on the way" meditation, polling-place link | §8, §10 "עמוד יום הבחירות" |
| `about.html` | Who's behind it (Assaf Geva, GitHub link), what we do, what we're not, transparency, credits | §10 "מי אנחנו", §14 |
| `sign.html` | Printable A4 sign: "נוכחים · מעגל נשימה", when/where lines to fill in, QR to the site | §10 host kit "חומרים" |
| `host-guide.html` | Printable one-page host guide: 30-minute flow, rules, roles, safety, election day, support lines | §10 host kit "חומרים" |
| `404.html` | Not-found page (GitHub Pages serves it for any missing path, e.g. old links to removed pages), `noindex` | build choice |

Removed in site v1.0 (design-v1 §8): `circles.html`, `journey.html`, `day-after.html`, `donate.html`.

Anchors on the home page: `#idea`, `#ways`, `#plan`, `#about`; `#support` on every page.

## Visual system
- **Colors** (CSS custom properties in `site/styles.css`): `--paper #f7f3ec`, `--ink #2b2925`, `--sage #6f8a72`, `--clay #b9684a`, `--sage-soft #e6ece4`, `--clay-soft`, plus the release's dark-mode set under `prefers-color-scheme: dark`. Darker `--sage-ink` / `--clay-ink` variants are used for text and button fills so they meet WCAG AA contrast.
- **Type:** Frank Ruhl Libre (headings, 500/700) and Assistant (body, 400/600/700), **self-hosted** woff2 (Hebrew + Latin subsets, ~140 KB total, SIL OFL, licences in `site/assets/fonts/`). Chosen over Google Fonts so the site makes no third-party requests.
- **Breathing circle:** CSS animation, 5 s in / 5 s out, with "שאיפה / נשיפה" labels.
- **Hero video strip:** Pexels clip "Golden wheat field swaying in the breeze" by †reny aleksa (credited in the hero). Colour muted toward sand/sage (the source is saturated yellow-orange, which §7 avoids). The clip doesn't loop, so it is pre-rendered as a ping-pong (forward, then reversed) whose speed eases to zero at each turn over 1.8 s: 30 s loop, 960×540, WebM VP9 + MP4 H.264, ~2 MB each, in `site/assets/video/`. A poster still shows first; the video loads only without reduced motion, data saver or 2G. The stop-motion button pauses it. The gradient stays underneath as a fallback.
- **Labels:** only `.tag-tts` "קול ממוחשב (AI)" remains (on every computer-voiced recording, and in the player). The "בקרוב" / "דוגמה" tags and the draft banner were removed in site v1.0.

## Content
- Page copy is hand-written HTML in `site/*.html`, taken from the release text. Header, footer (with the version line) and support section are identical on every page; the HTML files are the source, so when editing them, change all seven pages (including `404.html`) (`sign.html` and `host-guide.html` are standalone). Bump the version in every footer and in the printables' sheet footers.
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

## Traceability
| Design requirement (design-v1 §) | Technical decision | Status |
|---|---|---|
| §8 no draft banner, no "דוגמה" / "בקרוב" labels; v2 features simply absent | Banner markup, CSS and JS removed; tags removed; no placeholders for v2 | done |
| §8 / §9 computer-voice label stays | "קול ממוחשב (AI)" on each meditation card, the election-day card and the player (bar and full screen) | done |
| §8 home page structure | Hero (as before) · "הרעיון" (§10 text verbatim) · "דרכים להיות נוכחים" with listen + plan (circles and teachers are v2) · plan teaser · short about with link · support | done |
| §8 all site v0.2–v0.2.7 remarks adopted | Kept as built; version mark without "טיוטה" | done |
| §8 removed: sample circles, Great Silence, daily journey, day-after page, donations, "בקרוב" meditations | Pages deleted, home sections and nav items removed, links updated; `404.html` catches old links | done |
| §10 / §14 "לארץ הזאת" in dedications | Added to the fixed list in `plan.html` | done |
| §10 / §14 About: Assaf Geva, GitHub link, no nonprofit, no donations | `about.html` rewritten; "לא אוספים כסף" added to "what we're not"; contact via the GitHub profile (A8) | done |
| §10 detailed host kit, incl. "באים בלבן", 30-minute circle, election day as the peak | `host-kit.html` from `design-v1-content/host-kit.md`, adapted for no server (A7); sign and guide updated to match | done |
| §10 election day page unchanged; countdown wording approved (q. #7) | Only the "המחשה" tag removed and a host-kit link added | done |
| §7 visual language unchanged | No change | done |
| §5 / §13 neutrality in code and meta | All new copy, meta descriptions and the 404 page checked against the non-partisan test | done |
| §9, §14 v2 (server) features | Not built in v1; to be flagged before design-v2 is built | v2 |

## Assumptions
- **A1** (questions-for-design #1, answered): the draft banner wording and public deploy follow the user's answer, not the release's "internal, do not publish" text.
- **A7** (design-v1, question #10): the release's host kit has a step "לפתוח את המעגל באתר" (map, phone verification, delete), which is v2. In v1 the kit shows three steps (place, time, invite): "סימון במפה" for a private home reads "לפרסם נקודה כללית", and the invitation template ends "לתיאום: לכתוב לי בוואטסאפ" instead of a link to the circle's page. The rest of the kit is verbatim. When v2 is built the fourth step comes back.
- **A8** (design-v1): the release says removal requests reach the founder "through the contact details on the About page" but gives no contact details beyond the GitHub profile, so the About page offers contact through the GitHub profile. Waiting for the user to choose another channel if wanted.
- **A2:** the polling-place link points to the Central Elections Committee home page; the exact lookup URL for the 26th Knesset could not be verified from the build environment. Check before promoting.
- **A4** (question #3): support lines are ERAN 1201, NATAL 1-800-363-363, SAHAR (online chat), plus 101/100 for emergencies.

## Changelog
| Tech doc version | Implements | Date | Summary |
|---|---|---|---|
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
