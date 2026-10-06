# Technical design doc

**Implements:** `design/releases/design-v0.html` (design-v0, released 2026-10-06), plus the user's answer to questions-for-design #1 and the user's direct design remarks for site v0.2 (see below; to be folded into design-v1, question #6)
**Tech doc version:** t1.2.1 · **Site version:** v0.2.1 (shown in every page footer; approved by the user 2026-10-06)
**Stack:** see [`stack.md`](stack.md)

## Overview
design-v0 is a touchable prototype of the whole vision: a full home page, three sample meditations read by a temporary computer voice over quiet background music, a voting plan that really works, and previews of every future feature, clearly labelled. Per the user's decision (questions-for-design #1) it is deployed to the public GitHub Pages site as usual, with a draft banner on every page and no indexing block.

## Information architecture
Flat, static pages in `site/`, one shared header (brand + nav) and footer (support lines + neutrality line).

| File | Page | Release § |
|---|---|---|
| `index.html` | Home: hero, central meditation, three ways, voting plan, circles, the Great Silence, about | §8 "home page structure" |
| `meditations.html` | Three sample meditations + three "בקרוב" | §8 v0 pages, §9 |
| `circles.html` | Sample circles list + "host a circle" | §8 v0 pages |
| `host-kit.html` | Host kit draft, downloads "בקרוב" | §9 host kit |
| `journey.html` | Daily journey, three sample days | §8 v0 pages |
| `election-day.html` | 27.10: morning circles, "on the way" meditation, polling-place link | §8, §10 |
| `day-after.html` | 28.10: processing circles regardless of results | §8, §10 |
| `donate.html` | Explanation only, no payment | §9 donation page |
| `about.html` | About us: what we do, what we're not, who's behind it, transparency, credits | §8 "מי אנחנו" (expanded into its own page at the user's request) |
| `sign.html` | Printable A4 sign with QR code to the site, marked "טיוטה" | §9 host kit materials (draft, user request) |
| `host-guide.html` | Printable one-page host guide, marked "טיוטה" | §9 host kit materials (draft, user request) |

Anchors on the home page: `#listen`, `#ways`, `#plan`, `#circles`, `#great-silence`, `#about`; `#support` on every page.

## Visual system
- **Colors** (CSS custom properties in `site/styles.css`): `--paper #f7f3ec`, `--ink #2b2925`, `--sage #6f8a72`, `--clay #b9684a`, `--sage-soft #e6ece4`, `--clay-soft`, plus the release's dark-mode set under `prefers-color-scheme: dark`. Darker `--sage-ink` / `--clay-ink` variants are used for text and button fills so they meet WCAG AA contrast.
- **Type:** Frank Ruhl Libre (headings, 500/700) and Assistant (body, 400/600/700), **self-hosted** woff2 (Hebrew + Latin subsets, ~140 KB total, SIL OFL, licences in `site/assets/fonts/`). Chosen over Google Fonts so the site makes no third-party requests.
- **Breathing circle:** CSS animation, 5 s in / 5 s out, with "שאיפה / נשיפה" labels.
- **Hero video strip:** Pexels clip "Golden wheat field swaying in the breeze" by †reny aleksa (credited in the hero). Colour muted toward sand/sage (the source is saturated yellow-orange, which §7 avoids). The clip doesn't loop, so it is pre-rendered as a ping-pong (forward, then reversed) whose speed eases to zero at each turn over 1.8 s: 30 s loop, 960×540, WebM VP9 + MP4 H.264, ~2 MB each, in `site/assets/video/`. A poster still shows first; the video loads only without reduced motion, data saver or 2G. The stop-motion button pauses it. The gradient stays underneath as a fallback.
- **Labels:** `.tag-soon` "בקרוב", `.tag-sample` "דוגמה", `.tag-tts` "קול ממוחשב זמני"; disabled buttons are dashed `aria-disabled` spans, so nothing looks clickable that isn't.

## Content
- Page copy is hand-written HTML in `site/*.html`, taken from the release text. Header (with the draft banner), footer (with the version line) and support section are identical on every page; the HTML files are the source, so when editing them, change all nine pages (`sign.html` and `host-guide.html` are standalone). Bump the version in every footer and in the printables' sheet footers.
- Meditation scripts are copied verbatim from `design/releases/design-v0-meditations/` to `site/content/meditations/` (the deploy only ships `site/`); the same text is embedded in each meditation's "לקריאת התסריט" panel. Recordings and stanza timings are in `site/content/meditations/audio/`, made with `tech/tools/mix-meditation-audio.py`. The hero video loop is made with `tech/tools/video-pingpong.py`.
- Sample circles, journey days and Great Silence details are placeholders marked "דוגמה" / "בקרוב".

## Interactions & features
| Feature | Implementation | Fits stack? |
|---|---|---|
| Draft banner | Sticky note at the top of every page: "טיוטה: האתר עוד לא הושק. התכנים, הקולות והנתונים לדוגמה." Has a close (X) button (v0.2.1, user request); it stays closed for the browser session (`sessionStorage`, per viewer only) and comes back in a new session. The footer's "טיוטה · גרסה" line always stays | yes |
| Countdown to 27.10 | `assets/js/main.js`, target 2026-10-27 07:00 Israel time (UTC+2), updates every 30 s; text fallback | yes |
| Meditations (recordings) | Voice tracks from ElevenLabs (free tier, attributed), generated once from the release scripts. Mixed in the repo with ffmpeg: 3 s music pre-roll, voice, 6 s tail; the music bed is a soft D-A-E-F♯ pad about 19 dB under the voice, audible in the silences. Output: `site/content/meditations/audio/<id>.mp3` (mono, 80 kbps; 4.3 / 2.0 / 1.2 MB) and `<id>.json` stanza timings (silence detection; gaps of 1.5 s or more match the script's stanza breaks exactly) | yes (F1) |
| Global player (v0.2) | `player.js`: one `<audio>` outside `<main>`. Bottom bar fades in on play and out on close: play/pause, back 15 s, full screen, close (all icons), seek bar, time, title linking to `meditations.html#<id>`. Any `[data-play="<id>"]` button starts/toggles that meditation and shows its state; pages have descriptions + buttons, no embedded players. Full-screen overlay: slow breathing gradient (palette colours, static under reduced motion), stanza captions that cross-fade, big play/pause, Escape closes. Body gets bottom padding while the bar shows so the footer is never covered | yes |
| In-place navigation (v0.2) | `main.js`: same-site `.html` links fetch the page and swap `<main>` (title, description, nav state), `pushState`/`popstate` for back/forward, focus moves to the new `h1`, GoatCounter page view sent. Page set-up runs through `window.onPage`. Falls back to a normal page load on any error or without JS. Printables (`data-no-swap`, new tab), downloads and external links are untouched | yes (no build step, no library) |
| Download / share audio file | "להורדה" links with Hebrew file names; share buttons labelled "שיתוף" with the WhatsApp icon (Simple Icons, CC0; accessible name "שיתוף בוואטסאפ") share `meditations.html#<id>` for meditations or the page anchor otherwise; host kit links the main meditation as its audio file | yes |
| Printable drafts (v0.2) | `sign.html` and `host-guide.html`, A4 print CSS (`assets/print.css`), diagonal "טיוטה" watermark, "draft" toolbar note, version in the sheet footer. The sign's QR code is generated in the browser for the page's own address (`assets/js/vendor/qrcode.js`, qrcode-generator, MIT) | yes |
| Version mark (v0.2) | Footer line on every page: "טיוטה · גרסה v0.2 · date · מה השתנה" (links to this changelog). Set in one place in the page generator | yes |
| Voting plan | `assets/js/plan.js`: three questions (when: slot or exact time; with whom; whom I invite), no question on political views. Outputs a card, WhatsApp share text (`wa.me`), a PNG card drawn on `<canvas>` (Web Share with file, or download), an `.ics` event with alarms 1 h and 18 h before, and a link to the Central Elections Committee site. Nothing stored or sent: no cookies, no localStorage, no network calls | yes |
| Background video strip | `<video>` sources added by `main.js` when motion and connection allow; poster image otherwise | yes (F2, approved) |
| Measurement (plans, listens, shares) | GoatCounter script on every page. Page views plus anonymous events from `window.countEvent` (`main.js`): `plan-created`, `plan-whatsapp`, `plan-image`, `plan-calendar`, `listen-<script>`, `listen-complete-<script>`, `share-meditation-whatsapp`. Only the event name is sent, never what people type. A footer line says so | yes (F3, approved) |
| WhatsApp channel / groups / hosts group | "בקרוב" placeholders | needs links from the team |
| Donations | Explanation only, no payment UI | yes |

## Accessibility & performance
- `lang="he" dir="rtl"`, logical CSS properties (`inset-inline-*`, `padding-inline-*`), skip link, landmarks, one `h1` per page, `aria-current` in nav, visible focus rings, 44–48 px touch targets.
- `prefers-reduced-motion`: hero drift and breathing animation stop entirely; the stop-motion button covers everyone else.
- Player: current line in an `aria-live="polite"` region; full script readable as text; works without a voice.
- Mobile menu collapses behind a toggle only when JS runs; without JS the nav is a plain list.
- The only third-party request is GoatCounter's script and counter; no images other than an SVG icon, fonts preloaded; total page weight well under 300 KB.
- Verified with Playwright (Chromium) at 1280×900 and 390×844, light and dark: no console errors, no failed requests, no horizontal overflow.

## Site v0.2: user design remarks (2026-10-06)
Given directly by the user in the build chat, on top of design-v0. Not yet in a design release; question #6 asks the design chat to fold them into design-v1.
1. A single player docked at the bottom, fading in on play and out on stop, that keeps playing across pages. The meditations page shows descriptions with play buttons; every play button on the site drives this player. Full screen shows a gradient animation and fading captions. Icons instead of words. Clicking the title opens that meditation on the meditations page.
2. WhatsApp links get the WhatsApp icon.
3. Draft printable sign and host guide, marked as drafts.
4. A visible version mark.
5. The hero video is less visible behind the text (stronger paper veil in the text column).

## Traceability
| Design requirement (release §) | Technical decision | Status |
|---|---|---|
| §8 draft marking on every screen | Sticky draft banner, wording per questions-for-design #1 | done |
| §8 "בקרוב" / "דוגמה" / "קול ממוחשב זמני" labels | `.tag-*` classes on every unready feature, sample datum and recording | done |
| §8 home page structure 1–8 | `index.html` sections in that order; support (8) is on every page | done |
| §8 primary action: listen; secondary: voting plan | Hero buttons "להאזנה (7 דקות)" + "להכין תוכנית הצבעה" | done |
| §7 palette, type, breathing circle, space | CSS tokens, self-hosted fonts, CSS animation | done |
| §7 video strip | Eased ping-pong loop, no sound, pause button, poster for reduced motion / slow connections, paper-toned overlay | done |
| §9 / §13 TTS meditations with music | ElevenLabs voice + mixed music bed, labelled "קול ממוחשב זמני (ElevenLabs)" | done |
| §13 audio: light files, accessible player, download & share | 80 kbps mono MP3s, custom accessible player, download links | done |
| §13 voting plan in browser only, share card + calendar | `plan.js`, no storage | done |
| §8 polling-place link (CEC) | Link to `https://www.bechirot.gov.il/` | done (see A2) |
| §13 countdown to 27.10.2026 | `main.js` | done |
| §13 privacy-preserving measurement | GoatCounter, anonymous events | done |
| §8 v0 pages: meditations, circles, host kit, journey, donate, election day, day after | One page each | done |
| §9 trauma sensitivity | "You can stop any time" callout before players; support lines on every page | done |
| §5 / §13 neutrality in code and meta | All copy, meta descriptions and alt text checked against the non-partisan test | done |
| §13 v0 not indexed / no share preview | Superseded by the user's decision (#1): public, no indexing block; no Open Graph image | n/a |

## Assumptions
- **A1** (questions-for-design #1, answered): the draft banner wording and public deploy follow the user's answer, not the release's "internal, do not publish" text.
- **A2:** the polling-place link points to the Central Elections Committee home page; the exact lookup URL for the 26th Knesset could not be verified from the build environment. Check before promoting.
- **A3** (question #2): the Great Silence time and locations are "בקרוב".
- **A4** (question #3): support lines are ERAN 1201, NATAL 1-800-363-363, SAHAR (online chat), plus 101/100 for emergencies.
- **A5** (question #4): "באים בלבן" appears as one small "idea still being checked" line in the Great Silence section.
- **A6:** sample circle locations are spread across the country (north to south) so no single region or community is implied.

## Changelog
| Tech doc version | Implements | Date | Summary |
|---|---|---|---|
| t1.2.1 | design-v0 + user remarks | 2026-10-06 | v0.2 approved. Share buttons read "שיתוף" (icon carries WhatsApp); draft banner can be closed for the session; docs refreshed; audio and video tooling committed to `tech/tools/`. |
| t1.2 | design-v0 + user remarks | 2026-10-06 | Site v0.2: global bottom player + full-screen overlay with fading captions, in-place navigation so audio continues across pages, WhatsApp icons, draft printable sign (QR) and host guide, version mark in footer, fainter hero video. Removed the browser-TTS fallback (all three meditations are recorded). |
| t1.1 | design-v0 | 2026-10-06 | Wheat-field hero video (eased ping-pong), ElevenLabs recordings with music and live captions, GoatCounter, About page. |
| t1 | design-v0 | 2026-10-06 | Full v0 prototype: 8 pages, browser TTS meditations with generated music, working voting plan, countdown, self-hosted fonts. Flags F1–F3. F1: stay on browser TTS; F2: wheat video built; F3: GoatCounter built. |
| t0 | — | 2026-10-06 | Scaffold only |
