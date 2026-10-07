# mindfulness-action-26

נוֹכְחִים: a grassroots, non-partisan mindfulness initiative ahead of the Knesset elections (27.10.2026), and its website.

Any chat can do anything: design and ideation, the tech doc, building the site. **Talk to the user in the language they write in** (usually Hebrew for design). Code and `tech/` docs are in English. The design doc and all site content are in Hebrew (RTL).

## Files

| Path | What |
|---|---|
| `design/philosophy.html` | **The design doc** (Hebrew): vision, values, voice, visual language, structure, content. One living doc, kept current; git history holds older versions. |
| `design/content/` | Long-form content (Hebrew): meditation scripts, host kit, etc. |
| `design/notes/` | Free-form brainstorms and drafts. Not requirements. |
| `tech/design-doc.md` | How the site implements the design. |
| `tech/stack.md` | The stack, what it can't do, and decisions on flagged features. |
| `tech/tools/` | Scripts for generating assets (audio mix, video loop). |
| `site/` | The website, deployed to GitHub Pages from `main`. |
| `archive/` | Dropped directions, kept for reference only (see `archive/v2/README.md`). **Not requirements.** |

## How to work

- **Design is the source of truth.** When a design decision is made, whether in a design discussion or in passing while building, write it into `design/philosophy.html` (or `design/content/`) in the same commit. Don't let the site drift from the doc.
- **Keep the tech doc in step.** When the site changes in a way that matters, update `tech/design-doc.md`.
- **No version copies.** Edit the docs in place. Git history is the record: write clear commit messages that say what changed and why. For a big step, the user may ask for a git tag.
- **Show the site version.** It appears in every page footer. Bump it when the site changes.
- **Verify before shipping.** Serve with `python3 -m http.server -d site 8000` and check the changed pages at desktop and mobile widths (Playwright is available). Fix broken links and console errors.
- **Shipping:** work on the chat's branch; the site goes live when that work is merged to `main`. Push to `main` directly only when the user says to; otherwise open a PR.

## Tech stack

Static site on **GitHub Pages**: plain HTML, CSS and vanilla JS in `site/`, with no build step, deployed by `.github/workflows/pages.yml` on every push to `main` that touches `site/`. Details in [`tech/stack.md`](tech/stack.md).

**Any feature that the current stack can't handle (a server, a database, logins, payments, storing form data, third-party services) must be flagged to the user, with options, before it is built.** Record the decision in `tech/stack.md`.

## Non-negotiables (from the design doc)

- Strictly non-partisan: never suggest who to vote for and never ask. Check all copy against this.
- "Not therapy": the support lines and the formal disclaimer stay on every page.
- Accessible and fast: semantic HTML, AA contrast, keyboard navigation, reduced-motion support, light pages.
