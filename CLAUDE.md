# mindfulness-action-26

A grassroots movement and its website. Work is split between **two kinds of chat**, and every chat is exactly one of them:

| Role | Hebrew | Language | Works in | Role doc |
|---|---|---|---|---|
| **Design & ideation** | עיצוב ורעיונות | Hebrew | `design/` | [`agents/design.md`](agents/design.md) |
| **Stack & building** | טכנולוגיה ובנייה | English (site content in Hebrew) | `tech/`, `site/`, `.github/` | [`agents/build.md`](agents/build.md) |

## First thing in every chat: pick the role

1. If the user's first message makes the role obvious (talking about vision, values, tone, look and feel → design; tech doc, code, deploy, bugs → build), take that role.
2. Otherwise ask, before doing anything else:
   > Is this chat for **design & ideation** (עיצוב ורעיונות) or **stack & building** (בנייה)?
3. Read the role doc **in full** and follow it for the rest of the chat.
4. Stay in that role. If the user asks for something that belongs to the other role, say so in one line and suggest they take it to a chat for that role. If they insist, do it, but keep to the file ownership rules below.

## Who owns which files

| Path | Owner | Notes |
|---|---|---|
| `design/` | design | Hebrew. `philosophy.md` is the living draft; `releases/` holds frozen versions. |
| `tech/` | build | `design-doc.md`, `stack.md`; `questions-for-design.md` (written in Hebrew) is how build asks design questions. |
| `site/` | build | The website, deployed to GitHub Pages. |
| `.github/` | build | The deploy workflow. |
| `ITERATIONS.md` | both | Design adds a row when it releases a version; build fills in the rest of that row. |
| `README.md`, `CLAUDE.md`, `agents/` | the user | Only change these when the user asks. |

## The iteration loop

```
 design chat                                     build chat
 ───────────                                     ──────────
 ideate in philosophy.md / notes/
 release → design/releases/design-vN.md
          + CHANGELOG.md + ITERATIONS.md row  ──▶ read the latest release (diff it against
                                                  the last one already built)
                                                  update tech/design-doc.md (+ stack.md flags)
                                                  build site/ → deploy to Pages
                                                  mark the ITERATIONS.md row "live"
 read questions-for-design.md,           ◀────── open questions go in tech/questions-for-design.md
 keep iterating toward design-v(N+1)
```

- Build works **only** from the files in `design/releases/`, never from the draft `philosophy.md`, so design can keep iterating while a release is being built.
- Each release is a full snapshot. Build gets "what changed" by diffing the newest release against the last one it implemented.
- Work only reaches the other role through `main`. Each chat may run on its own branch, so when a release, or a build of one, is finished, get it merged to `main`: push directly if the user says to, otherwise open a PR.

## Tech stack (short version)

Static site on **GitHub Pages**: plain HTML, CSS and JS in `site/`, with no build step, deployed by `.github/workflows/pages.yml`. Details, and the list of features that would force a stack change, are in [`tech/stack.md`](tech/stack.md). **Any feature that the current stack can't handle must be flagged to the user before it is built.**
