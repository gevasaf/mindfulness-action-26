# Tech stack

## Current stack (initial, iteration 0)

| Layer | Choice | Why |
|---|---|---|
| Hosting | **GitHub Pages** | Free, no servers, deploys from this repo. |
| Site | Plain **HTML + CSS + vanilla JS** in `site/` | No build step and no dependencies, so it's easy to change between iterations. |
| Deploy | GitHub Actions (`.github/workflows/pages.yml`) | Every push to `main` that touches `site/` gets deployed. |
| Language/direction | Hebrew, `lang="he" dir="rtl"` | The movement's audience. |
| Fonts | **Self-hosted** Assistant + Frank Ruhl Libre (woff2, SIL OFL) in `site/assets/fonts/` | No third-party requests; fast. |
| Audio (v0) | Pre-rendered MP3s in `site/content/meditations/audio/` (ElevenLabs voice + generated music, mono 80 kbps) with stanza timing JSON; browser TTS fallback | Shareable files, same voice everywhere. See F1. |

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

| Design version | Feature | Options considered | Recommendation | User decision |
|---|---|---|---|---|
| design-v0 | **F1. Hebrew TTS audio files** (download/share as a WhatsApp file, same voice on every device) | (a) Keep browser TTS (built): free, no service, but voice quality varies by device and some devices have no Hebrew voice (then the words show on screen). (b) Pre-render MP3s with a cloud TTS (Google, Azure, ElevenLabs): consistent voice and downloadable files, but needs an account, a licence check for publishing synthetic audio, and maybe cost. (c) Skip to human recordings for v1, as the design plans. | (a) for v0, then (c). Only take (b) if the team needs shareable files before teachers record. | **(b) built** (2026-10-06): ElevenLabs free tier, attributed ("קול ממוחשב זמני (ElevenLabs)" + About page). Voice tracks generated once outside the repo with a one-time key (since revoked), mixed here with a generated music bed. Browser TTS stays as the fallback for players without `data-audio`. |
| design-v0 | **F2. Background video strip** | (a) Free stock clip (Pexels, Pixabay, Mixkit) under its licence, compressed to ~1–2 MB WebM/MP4, with poster image: stays on Pages. (b) Keep the CSS gradient stand-in (built). | (a) once someone picks a clip that passes the neutrality rules (§7); build needs the file and its licence link. | **(a) built** (2026-10-06): Pexels clip by †reny aleksa (Pexels licence, credited), pre-rendered as an eased ping-pong loop, ~2 MB WebM + MP4. |
| design-v0 | **F3. Privacy-preserving measurement** (voting plans, listens, shares) | (a) GoatCounter (free for non-commercial, no cookies, can self-host). (b) Plausible (paid, EU, no cookies). (c) Cloudflare Web Analytics (free, no cookies, needs Cloudflare account). (d) No measurement. All are third-party scripts, so a privacy note on the site is needed. | (a) GoatCounter, counting only page views and anonymous events (no plan contents). Not built until approved. | **(a) built** (2026-10-06): `mindfulness-action-26.goatcounter.com`, script on every page. |

## Stack change log
| Date | Change | Reason | Approved by user |
|---|---|---|---|
| 2026-10-06 | Initial stack: static HTML/CSS/JS on GitHub Pages | Simplest start | yes |
| 2026-10-06 | GoatCounter analytics (hosted, free non-commercial, no cookies) | F3, measurement for design-v0 §13 | yes |
| 2026-10-06 | Self-hosted fonts; browser-only TTS and generated music for v0 | design-v0, no new service or dependency | within current stack |
