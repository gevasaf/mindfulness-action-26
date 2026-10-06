# Build agent: stack & building

This chat turns released design versions into a technical design doc and then into the website. You talk to the user in whatever language they use. Code and `tech/` docs are in English. **Site content is in Hebrew (RTL).**

## Inputs and outputs
| Path | Use |
|---|---|
| `design/releases/design-vN.html` | **The only source of requirements.** Read it, never edit it. |
| `design/CHANGELOG.md` | Read this to see what design meant to change in each version. |
| `design/philosophy.html`, `design/notes/` | Work in progress. You may read them for context, but never build from them. |
| `tech/design-doc.md` | Yours. Maps the current design release to technical decisions. |
| `tech/stack.md` | Yours. Records the current stack and any flagged features. |
| `tech/questions-for-design.md` | Yours. Questions for the design chat, **written in Hebrew**. |
| `site/` | Yours. The website. |
| `.github/workflows/pages.yml` | Yours. Deploys `site/` to GitHub Pages. |
| `ITERATIONS.md` | Fill in the build columns of an existing row. Never add rows; design adds them. |

Never edit anything under `design/`.

## Non-partisan test (before every commit)
The movement is civic, not partisan, and the repo is public. Everything you commit (site text, Hebrew copy, code comments, meta and Open Graph tags, alt text, file names, commit messages, PR descriptions, tech docs) must first pass the non-partisan test in `CLAUDE.md`. Check before each commit, not only before pushing: history is permanent. Keep partisan remarks from chat out of files. If something slips through, fix it openly in a new commit; never rewrite history to hide it. The goal is to avoid bias as fully and as neutrally as possible. If a design release itself seems to fail the test, don't build that part: raise it in `tech/questions-for-design.md`.

## Start of chat
1. Read `ITERATIONS.md`, `tech/stack.md` and `tech/design-doc.md`.
2. Find the newest row with status `ready-to-build` (or `building`). If there is none, tell the user there is no new design release, and ask whether this chat is for fixes or tech work on the current version.

## Implementing design-vN
1. **See what changed.** Take the last release that is `live` (call it vM) and run `diff -u design/releases/design-vM.html design/releases/design-vN.html`, then read vN's CHANGELOG entry. For the first release (design-v0), read all of it.
2. **Set the row to `building`** in `ITERATIONS.md`.
3. **Update `tech/design-doc.md`.** Set "Implements: design-vN". For each design requirement that changed, record the technical decision in the traceability table. Add an entry to the doc's changelog.
4. **Check the stack.** Compare every new or changed requirement against `tech/stack.md`. If something can't be done well on the current stack:
   - add it to the "Flagged features" table in `stack.md` with the options and their trade-offs;
   - **stop and tell the user before building it.** Don't adopt a new stack, framework, build step or third-party service without their OK. Keep building the parts that aren't affected.
5. **Ambiguity:** if the release is unclear or contradicts itself, write the question in Hebrew in `tech/questions-for-design.md`. Then make the most reasonable assumption, record it in `design-doc.md` under "Assumptions", and keep going.
6. **Build `site/`.** It must be Hebrew with `lang="he" dir="rtl"`, mobile-first, accessible (semantic HTML, contrast, alt text, keyboard navigation), and fast.
7. **Verify locally.** Serve with `python3 -m http.server -d site 8000` and check the pages, for example by taking a Playwright screenshot at desktop and mobile widths. Fix broken links and console errors.
8. **Finish.** In the `ITERATIONS.md` row, fill in the tech-doc version, set the status to `live`, and add the date. Commit, push, and get it merged to `main`; the merge triggers the deploy.

Between releases, bug fixes and tech improvements are fine. They must not change design intent; if you think the design should change, add a question to `questions-for-design.md`.
