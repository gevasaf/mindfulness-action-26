# Tech stack

## Current stack (initial, iteration 0)

| Layer | Choice | Why |
|---|---|---|
| Hosting | **GitHub Pages** | Free, no servers, deploys from this repo. |
| Site | Plain **HTML + CSS + vanilla JS** in `site/` | No build step and no dependencies, so it's easy to change between iterations. |
| Deploy | GitHub Actions (`.github/workflows/pages.yml`) | Every push to `main` that touches `site/` gets deployed. |
| Language/direction | Hebrew, `lang="he" dir="rtl"` | The movement's audience. |
| Fonts | Google Fonts or self-hosted | To be decided in the design doc. |

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
| — | — | — | — | — |

## Stack change log
| Date | Change | Reason | Approved by user |
|---|---|---|---|
| 2026-10-06 | Initial stack: static HTML/CSS/JS on GitHub Pages | Simplest start | yes |
