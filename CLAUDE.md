# mindfulness-action-26

נוֹכְחִים: a grassroots, non-partisan mindfulness initiative ahead of the Knesset elections (27.10.2026), and its website.

Any chat can do anything: design and ideation, the tech doc, building the site. **Talk to the user in the language they write in** (usually Hebrew for design). Code and `tech/` docs are in English. The design doc and all site content are in Hebrew (RTL).

## Non-partisan test (applies to every commit)

The movement is civic, not partisan, and **this repository is public**. Anything committed to the repo (design docs, notes, brainstorms, drafts, tech docs, site text, code comments, meta tags, alt text, file names, commit messages, PR titles and descriptions) must pass a non-partisan test **before it is committed**. Once pushed, a commit is public and stays in the history, so run the test at commit time, not at push time. A "draft" or "just notes" is not an exception. The goal is to avoid bias as fully and as neutrally as possible. Reasons: the law (the Party Financing Law rules on bodies active in elections), and trust (the audience recognizes manipulation and stops trusting).

Before every commit, check that the change:
1. Names no parties, candidates, blocs, "coalition" or "opposition", and doesn't hint at whom to vote for.
2. Uses no political "us vs. them". "We" means everyone who lives here.
3. Describes the events of recent years as shared experience, without blame or assigning responsibility.
4. Doesn't use fear, or an imagined future tied to a particular election result, to move people.
5. Contains no strategy for targeting voters by their political views, and collects no data about them.
6. **The neighbor test:** would someone with different political views from ours feel at home reading it, and share it?

If anything fails, rewrite it before committing. The full rules are in the "neutrality" section of `design/philosophy.html`. This applies to design ideas too: even when the user gets carried away, stop and suggest a neutral wording.

**What the user says in chat stays in chat.** The user may share personal political views, guesses about how some group votes, or strategic thoughts that can't pass the test. That's fine in conversation, but it never goes into a file or a commit message. If the user asks to record something that fails the test, say so, suggest a neutral wording, and record only that. In brainstorm notes, record only the ideas, in neutral wording.

**We are transparent.** If a problematic commit slips through anyway, fix it openly with a new commit that explains the fix. Don't rewrite history (no amend, rebase or force-push to hide it), and don't delete it. Everything we publish, including drafts, is public by choice: we have nothing to hide; something can be public before it is promoted.

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
| Branch `archive/v2` | The dropped v2 direction (server features), docs and code, kept for reference only. **Not requirements.** |

## How to work

- **In design discussions, be a thinking partner, not a scribe:** ask questions, offer alternatives, challenge assumptions, and point out where a decision contradicts the values. Decided things go into the design doc; undecided ideas go into `design/notes/` or the doc's open-questions section.
- **Design is the source of truth.** When a design decision is made, whether in a design discussion or in passing while building, write it into `design/philosophy.html` (or `design/content/`) in the same commit. Don't let the site drift from the doc.
- **Keep the tech doc in step.** When the site changes in a way that matters, update `tech/design-doc.md`.
- **No version copies.** Edit the docs in place. Git history is the record: write clear commit messages that say what changed and why. For a big step, the user may ask for a git tag.
- **Show the site version.** It appears in every page footer. Bump it when the site changes.
- **Verify before shipping.** Serve with `python3 -m http.server -d site 8000` and check the changed pages at desktop and mobile widths (Playwright is available). Fix broken links and console errors.
- **`CLAUDE.md` and `README.md`** change only when the user asks.
- **Shipping:** work on the chat's branch; the site goes live when that work is merged to `main`. Push to `main` directly only when the user says to; otherwise open a PR.

## Tech stack

Static site on **GitHub Pages**: plain HTML, CSS and vanilla JS in `site/`, with no build step, deployed by `.github/workflows/pages.yml` on every push to `main` that touches `site/`. Details in [`tech/stack.md`](tech/stack.md).

**Any feature that the current stack can't handle (a server, a database, logins, payments, storing form data, third-party services) must be flagged to the user, with options, before it is built.** Record the decision in `tech/stack.md`.

## Other non-negotiables (from the design doc)

- "Not therapy": the support lines and the formal disclaimer stay on every page.
- Accessible and fast: semantic HTML, AA contrast, keyboard navigation, reduced-motion support, light pages.
