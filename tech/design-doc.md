# Technical design doc

**Implements:** `design/releases/design-v0.html` (design-v0, released 2026-10-06), plus the user's answer to questions-for-design #1
**Tech doc version:** t1
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

Anchors on the home page: `#listen`, `#ways`, `#plan`, `#circles`, `#great-silence`, `#about`; `#support` on every page.

## Visual system
- **Colors** (CSS custom properties in `site/styles.css`): `--paper #f7f3ec`, `--ink #2b2925`, `--sage #6f8a72`, `--clay #b9684a`, `--sage-soft #e6ece4`, `--clay-soft`, plus the release's dark-mode set under `prefers-color-scheme: dark`. Darker `--sage-ink` / `--clay-ink` variants are used for text and button fills so they meet WCAG AA contrast.
- **Type:** Frank Ruhl Libre (headings, 500/700) and Assistant (body, 400/600/700), **self-hosted** woff2 (Hebrew + Latin subsets, ~140 KB total, SIL OFL, licences in `site/assets/fonts/`). Chosen over Google Fonts so the site makes no third-party requests.
- **Breathing circle:** CSS animation, 5 s in / 5 s out, with "שאיפה / נשיפה" labels.
- **Hero background:** slow drifting warm gradient as a stand-in for the video strip (see flagged features), with a visible "stop motion" button.
- **Labels:** `.tag-soon` "בקרוב", `.tag-sample` "דוגמה", `.tag-tts` "קול ממוחשב זמני"; disabled buttons are dashed `aria-disabled` spans, so nothing looks clickable that isn't.

## Content
- Page copy is hand-written HTML in `site/*.html`, taken from the release text. Header, footer and support section are identical on every page; when editing them, change all eight files.
- Meditation scripts are copied verbatim from `design/releases/design-v0-meditations/` to `site/content/meditations/` (the deploy only ships `site/`). The player fetches and parses them at runtime, so a new release's scripts are a file copy.
- Sample circles, journey days and Great Silence details are placeholders marked "דוגמה" / "בקרוב".

## Interactions & features
| Feature | Implementation | Fits stack? |
|---|---|---|
| Draft banner | Sticky note at the top of every page: "טיוטה: האתר עוד לא הושק. התכנים, הקולות והנתונים לדוגמה." | yes |
| Countdown to 27.10 | `assets/js/main.js`, target 2026-10-27 07:00 Israel time (UTC+2), updates every 30 s; text fallback | yes |
| Meditations (TTS + music) | `assets/js/player.js`: browser **Web Speech API** with the device's Hebrew voice, rate 0.72; `[שקט X שניות]` → X s silence, blank line → 2.5 s. Music is a soft pad **generated with Web Audio** (no file, no licence). If no Hebrew voice exists, "silent reading" mode shows each line on screen at the script's pace. Live caption of the current line, play/pause/restart, music toggle, script in a `<details>` | yes (interim, see flag F1) |
| Download / share audio file | "בקרוב" (no audio files exist yet); "send on WhatsApp" shares the page link | flag F1 |
| Voting plan | `assets/js/plan.js`: three questions (when: slot or exact time; with whom; whom I invite), no question on political views. Outputs a card, WhatsApp share text (`wa.me`), a PNG card drawn on `<canvas>` (Web Share with file, or download), an `.ics` event with alarms 1 h and 18 h before, and a link to the Central Elections Committee site. Nothing stored or sent: no cookies, no localStorage, no network calls | yes |
| Background video strip | CSS gradient stand-in + "רצועת וידאו: בקרוב" | flag F2 |
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

## Traceability
| Design requirement (release §) | Technical decision | Status |
|---|---|---|
| §8 draft marking on every screen | Sticky draft banner, wording per questions-for-design #1 | done |
| §8 "בקרוב" / "דוגמה" / "קול ממוחשב זמני" labels | `.tag-*` classes on every unready feature, sample datum and recording | done |
| §8 home page structure 1–8 | `index.html` sections in that order; support (8) is on every page | done |
| §8 primary action: listen; secondary: voting plan | Hero buttons "להאזנה (7 דקות)" + "להכין תוכנית הצבעה" | done |
| §7 palette, type, breathing circle, space | CSS tokens, self-hosted fonts, CSS animation | done |
| §7 video strip | Gradient stand-in, pause button, reduced-motion static | partial, F2 |
| §9 / §13 TTS meditations with music | Web Speech API + Web Audio pad | done (interim), F1 |
| §13 audio: light files, accessible player, download & share | Accessible player; share link; download "בקרוב" | partial, F1 |
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
| t1 | design-v0 | 2026-10-06 | Full v0 prototype: 8 pages, browser TTS meditations with generated music, working voting plan, countdown, self-hosted fonts. Flags F1–F3. F1: stay on browser TTS; F2: stay on gradient; F3: GoatCounter built. |
| t0 | — | 2026-10-06 | Scaffold only |
