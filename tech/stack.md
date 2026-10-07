# Tech stack

## Current stack

| Layer | Choice | Why |
|---|---|---|
| Hosting | **GitHub Pages** | Free, no servers, deploys from this repo. |
| Site | Plain **HTML + CSS + vanilla JS** in `site/` | No build step and no dependencies, so it's easy to change between iterations. |
| Deploy | GitHub Actions (`.github/workflows/pages.yml`) | Every push to `main` that touches `site/` gets deployed. |
| Language/direction | Hebrew, `lang="he" dir="rtl"` | The movement's audience. |
| Fonts | **Self-hosted** Assistant + Frank Ruhl Libre, plus M PLUS Rounded 1c for the brand name (v1.0.1) and all titles (v1.0.6) (Hebrew subset with niqqud, 5 KB, + Latin subset, 22 KB) (woff2, SIL OFL) in `site/assets/fonts/` | No third-party requests; fast. |
| Navigation (v0.2) | Vanilla JS in-place navigation (swap `<main>`, History API) | Lets the meditation player keep playing across pages. No framework, no build step; plain page loads without JS. |
| Third-party code | `site/assets/js/vendor/qrcode.js` (qrcode-generator, MIT), self-hosted | QR on the printable sign. |
| Audio (v0) | Pre-rendered MP3s in `site/content/meditations/audio/` (ElevenLabs voice + generated music, mono 80 kbps) with stanza timing JSON, played by the global player (`player.js`) | Shareable files, same voice everywhere. See F1. |

### One-time setup (repo owner)
- Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. The deploy workflow fails until this is set.
- GitHub Pages on a **private** repo needs a paid GitHub plan. On a free plan the repo must be public.
- Custom domain (optional): add it in Settings → Pages and put a `site/CNAME` file in the repo.

## What GitHub Pages can't do

GitHub Pages only serves static files. It has **no server, no database, and no secrets**. Any incoming design feature in this list must be **flagged to the user before it is built**:

| Feature | Why it doesn't fit | Typical options |
|---|---|---|
| Forms that store data (sign-ups, petitions, contact) | Nowhere to store submissions | Embedded Google Forms or Tally; Formspree; serverless function + DB |
| Mailing list / newsletter | Needs an email service | Mailchimp, Buttondown, or Brevo embed |
| User accounts / login / member area | Needs auth and a backend | Firebase or Supabase auth; move to Netlify or Vercel |
| Donations / payments | Needs a payment provider | Stripe Payment Links, PayPal, or Israeli providers (e.g. Meshulam, Cardcom) |
| Content edited by non-technical people | Editing HTML in git is hard | Static site generator + headless CMS (Decap, Tina), or Notion/Sheets as data |
| Many pages with shared layout / blog / events list | Copy-pasting HTML doesn't scale | Jekyll (built into Pages), Astro, or Eleventy |
| Community-submitted content, comments, live map | Needs dynamic data | Backend (Supabase or Firebase) or third-party embeds |
| Site search over lots of content | Fine up to a point | Client-side index (Pagefind or Lunr); beyond that, a hosted search service |
| Server-side analytics or private API keys | No secrets on a static site | Privacy-friendly analytics script (Plausible, GoatCounter); serverless proxy |

Third-party embeds keep us on Pages, but they are still a decision (privacy, cost, vendor), so they must be flagged too.

## Flagged features (pending user decision)

> F4–F9 were approved for design-v2, but that direction was **dropped on 2026-10-07**. None of it is on `main`; its docs and code are on the `archive/v2` branch. A new design that needs a server must be flagged again.

| Design version | Feature | Options considered | Recommendation | User decision |
|---|---|---|---|---|
| design-v0 | **F1. Hebrew TTS audio files** (download/share as a WhatsApp file, same voice on every device) | (a) Keep browser TTS (built): free, no service, but voice quality varies by device and some devices have no Hebrew voice (then the words show on screen). (b) Pre-render MP3s with a cloud TTS (Google, Azure, ElevenLabs): consistent voice and downloadable files, but needs an account, a licence check for publishing synthetic audio, and maybe cost. (c) Skip to human recordings for v1, as the design plans. | (a) for v0, then (c). Only take (b) if the team needs shareable files before teachers record. | **(b) built** (2026-10-06): ElevenLabs free tier, attributed ("קול ממוחשב זמני (ElevenLabs)" + About page). Voice tracks generated once outside the repo with a one-time key (since revoked), mixed here with a generated music bed. The browser-TTS fallback was removed in site v0.2. |
| design-v0 | **F2. Background video strip** | (a) Free stock clip (Pexels, Pixabay, Mixkit) under its licence, compressed to ~1–2 MB WebM/MP4, with poster image: stays on Pages. (b) Keep the CSS gradient stand-in (built). | (a) once someone picks a clip that passes the neutrality rules (§7); build needs the file and its licence link. | **(a) built** (2026-10-06): Pexels clip by †reny aleksa (Pexels licence, credited), pre-rendered as an eased ping-pong loop, ~2 MB WebM + MP4. |
| design-v0 | **F3. Privacy-preserving measurement** (voting plans, listens, shares) | (a) GoatCounter (free for non-commercial, no cookies, can self-host). (b) Plausible (paid, EU, no cookies). (c) Cloudflare Web Analytics (free, no cookies, needs Cloudflare account). (d) No measurement. All are third-party scripts, so a privacy note on the site is needed. | (a) GoatCounter, counting only page views and anonymous events (no plan contents). Not built until approved. | **(a) built** (2026-10-06): `mindfulness-action-26.goatcounter.com`, script on every page. |
| design-v2 | **F4. Backend: database, file storage, phone verification, admin** (teacher uploads, circles, reports, admin page) | (a) **Supabase**: Postgres + storage + phone OTP auth + row-level security + edge functions, one vendor, open source. Free tier: 500 MB DB, 1 GB files, 5 GB egress/month, **pauses after 7 days without activity**; Pro $25/month. (b) **Firebase**: Firestore + storage + phone auth + Cloud Functions; needs the pay-as-you-go plan for functions; NoSQL makes the sanity checks (duplicates, daily limits, distance) clumsier. (c) **Own small server** (Fly.io/Render/VPS, Node or Python + SQLite): full control, ffmpeg runs natively, but we run and secure it ourselves. | **(a) Supabase.** Free tier to start; move to Pro (~$25 × 2 months, Oct–Nov) if listens of teacher audio approach the 5 GB egress cap. The site stays static on GitHub Pages and talks to Supabase from the browser; the admin page is a static page that only the founder's verified phone can use (row-level security). | **(a) Supabase** (user, 2026-10-06) |
| design-v2 | **F5. SMS codes to Israeli numbers** (opening and deleting circles, teacher uploads) | (a) **Twilio Verify** via Supabase: reliable, built-in fraud guard; Israel SMS list price ~$0.26/message ([Twilio](https://www.twilio.com/sms/pricing/il)), plus $0.05 per successful verification for Verify. (b) **A cheaper provider** through Supabase's "Send SMS" hook (Sinch/Infobip ~$0.17; local Israeli routes may be far cheaper but need checking). (c) **WhatsApp codes** (Twilio Verify WhatsApp channel): usually cheaper than SMS in Israel, and circle openers have WhatsApp anyway; not everyone does. Estimated volume: 150–400 codes in total → roughly $40–120 with (a). | **(a) Twilio Verify with SMS**, a monthly spending cap, and rate limits (one code per number per minute, per-IP limits). Revisit (b)/(c) if volume grows. | **(a) Twilio Verify, SMS** (user, 2026-10-06) |
| design-v2 | **F6. Bot protection on code requests** (SMS-pumping fraud costs money) | (a) **Cloudflare Turnstile**: free, no cookies for tracking, usually invisible. (b) hCaptcha / reCAPTCHA (more tracking). (c) Rate limits only. | **(a) Turnstile** on "send code" plus rate limits. It is a third-party script, so the privacy note on the site mentions it. | **(a) Turnstile** (accepted with the stack, 2026-10-06) |
| design-v2 | **F7. Processing teacher recordings** (music mix with ffmpeg, transcription, AI rating) | (a) **A GitHub Actions job** in this repo, every ~10 minutes: picks up new uploads from Supabase, mixes with `tech/tools/mix-meditation-audio.py` (same music bed), transcribes, rates with Claude, writes results back. Free for a public repo; delays of minutes don't matter because a human approves anyway. (b) Supabase edge function: no ffmpeg there, so mixing still needs (a) or (c). (c) Own server. Transcription: Hebrew-capable speech-to-text API (e.g. ElevenLabs Scribe, already used for the voices, or OpenAI Whisper), a few dollars at this volume. AI rating: Claude Opus 5.5 via the Anthropic API; ~50 transcripts ≈ $2 in total. | **(a) GitHub Actions + ElevenLabs Scribe + Claude Opus 5.5.** Keys live in GitHub Actions secrets, never in the repo. | **(a) GitHub Actions + speech-to-text + Claude Opus 5.5** (user, 2026-10-06) |
| design-v2 | **F8. Map** (circles map, "pick a spot" when opening a circle) | (a) **MapLibre GL (self-hosted JS) + Protomaps vector tiles for the region, self-hosted, styled in the site palette with the boundary layer removed**: matches "quiet, palette colours" and the neutrality note (no border line drawn), no third-party map requests. (b) Leaflet + CARTO Positron tiles: quick, light grey, free for low traffic, but draws administrative boundaries and is a third-party request. (c) Leaflet + OpenStreetMap standard tiles: colourful, draws boundaries, usage policy limits. | **(a)**, with the full list/schedule view as the accessible alternative (design §14). | **(a) self-hosted, palette, no boundary lines** (user, 2026-10-06) |
| design-v2 | **F9. Personal data** (verified phone numbers, teachers' names and photos) | Required by design: phone numbers only, no email, everything deleted by 30.11.2026. Needs a privacy notice on the site, consent texts reviewed by a lawyer (design §13 already says so), and a scheduled deletion job. | Build the privacy page and the 30.11 deletion job; the user arranges the legal review of the consent texts before launch. | **accepted**; lawyer review of consent texts is the user's (2026-10-06) |

### Decided for design-v1.1 (2026-10-07, no new service)
| Feature | Options considered | User decision |
|---|---|---|
| **F10. Page of social posts by hashtag** | Automatic collection needs a server and platform API access (Instagram: business account, app review, server-side token; X: paid API; TikTok and Facebook: no public hashtag search). Embeds load the platforms' tracking scripts. Manual curation would stay static. | **Dropped** (user, 2026-10-07): technically problematic, and unclear and unattractive as a page. |
| **F11. Link that creates a WhatsApp group** for a circle | Not possible: WhatsApp links can open a chat or share text, not create a group (group creation exists only in the business API). | Kit gives steps plus copy buttons and a group image. |
| **F12. Circle group QR on the sign** | Generated in the browser with the existing self-hosted QR library; the link is never stored or sent. | Built (fits the stack). |
| **F14. Contact form** (no phone or email on the site) | (a) **Web3Forms**: an HTML form on the About page posts to their API, which emails the founder; the address stays hidden (only a public access key is in the page); free up to 250 messages/month; honeypot field against spam. (b) Google Forms link: no code, but visitors leave the site for Google. (c) Tally: similar to (b). | **(a) Web3Forms** (user, 2026-10-07). The page says the message goes only to the founder via Web3Forms and is not stored on the site. |
| **F13. Measurement without registration** | Existing GoatCounter: anonymous events for kit PDF, prints and copies; `utm_source=sign` on the sign's QR. Posts with the hashtag counted by hand, no data about who posts. | Built (within F3). |

## Stack change log
| Date | Change | Reason | Approved by user |
|---|---|---|---|
| 2026-10-07 | Web3Forms contact form on the About page (F14) | contact without publishing a phone or email | yes |
| 2026-10-07 | `tech/tools/make-assets.mjs` (Playwright, Pillow) renders the kit PDF, the teachers' call PDF and the circle group image; GoatCounter also on the printables | design-v1.1 | within current stack |
| 2026-10-07 | Server stack (F4–F9) shelved, never deployed | design-v2 dropped | yes |
| 2026-10-06 | Supabase (DB, storage, phone OTP, RLS, edge functions), Twilio Verify SMS, Cloudflare Turnstile, GitHub Actions worker (ffmpeg mix, ElevenLabs Scribe, Claude Opus 5.5), self-hosted MapLibre + Protomaps tiles | design-v2 (F4–F9) | yes |
| 2026-10-06 | Initial stack: static HTML/CSS/JS on GitHub Pages | Simplest start | yes |
| 2026-10-06 | In-place navigation (vanilla JS) and a self-hosted QR library | Site v0.2: player continues across pages; printable sign | yes |
| 2026-10-06 | GoatCounter analytics (hosted, free non-commercial, no cookies) | F3, measurement for design-v0 §13 | yes |
| 2026-10-06 | Self-hosted fonts; browser-only TTS and generated music for v0 | design-v0, no new service or dependency | within current stack |
