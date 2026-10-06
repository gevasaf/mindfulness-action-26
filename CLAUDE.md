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

## Non-partisan test (applies to every commit)

The movement is civic, not partisan, and **this repository is public**. Anything committed to the repo (design docs, notes, brainstorms, drafts, tech docs, site text, code comments, meta tags, alt text, commit messages, PR titles and descriptions) must pass a non-partisan test **before it is committed**. Once pushed, a commit is public and stays in the history, so run the test at commit time, not at push time. A "draft" or "just notes" is not an exception. The goal is to avoid bias as fully and as neutrally as possible. Reasons: the law (the Party Financing Law rules on bodies active in elections), and trust (the audience recognizes manipulation and stops trusting).

Before every push, check that the change:
1. Names no parties, candidates, blocs, "coalition" or "opposition", and doesn't hint at whom to vote for.
2. Uses no political "us vs. them". "We" means everyone who lives here.
3. Describes the events of recent years as shared experience, without blame or assigning responsibility.
4. Doesn't use fear, or an imagined future tied to a particular election result, to move people.
5. Contains no strategy for targeting voters by their political views, and collects no data about them.
6. **The neighbor test:** would someone with different political views from ours feel at home reading it, and share it?

If anything fails, rewrite it before committing. The full rules are in the "neutrality" section of `design/philosophy.html`.

**What the user says in chat stays in chat.** The user may share personal political views, guesses about how some group votes, or strategic thoughts that can't pass the test. That's fine in conversation, but it never goes into a file or a commit message. If the user asks to record something that fails the test, say so, suggest a neutral wording, and record only that.

**We are transparent.** If a problematic commit slips through anyway, fix it openly with a new commit that explains the fix. Don't rewrite history (no amend, rebase or force-push to hide it), and don't delete it. Everything we publish, including drafts, is public by choice: we have nothing to hide; something can be public before it is promoted.

## Who owns which files

| Path | Owner | Notes |
|---|---|---|
| `design/` | design | Hebrew. `philosophy.html` is the living draft; `releases/` holds frozen versions. |
| `tech/` | build | `design-doc.md`, `stack.md`; `questions-for-design.md` (written in Hebrew) is how build asks design questions. |
| `site/` | build | The website, deployed to GitHub Pages. |
| `.github/` | build | The deploy workflow. |
| `ITERATIONS.md` | both | Design adds a row when it releases a version; build fills in the rest of that row. |
| `README.md`, `CLAUDE.md`, `agents/` | the user | Only change these when the user asks. |

## The iteration loop

```
 design chat                                     build chat
 ───────────                                     ──────────
 ideate in philosophy.html / notes/
 release → design/releases/design-vN.html
          + CHANGELOG.md + ITERATIONS.md row  ──▶ read the latest release (diff it against
                                                  the last one already built)
                                                  update tech/design-doc.md (+ stack.md flags)
                                                  build site/ → deploy to Pages
                                                  mark the ITERATIONS.md row "live"
 read questions-for-design.md,           ◀────── open questions go in tech/questions-for-design.md
 keep iterating toward design-v(N+1)
```

- Build works **only** from the files in `design/releases/`, never from the draft `philosophy.html`, so design can keep iterating while a release is being built.
- Each release is a full snapshot. Build gets "what changed" by diffing the newest release against the last one it implemented.
- Work only reaches the other role through `main`. Each chat may run on its own branch, so when a release, or a build of one, is finished, get it merged to `main`: push directly if the user says to, otherwise open a PR.

## Tech stack (short version)

Static site on **GitHub Pages**: plain HTML, CSS and JS in `site/`, with no build step, deployed by `.github/workflows/pages.yml`. Details, and the list of features that would force a stack change, are in [`tech/stack.md`](tech/stack.md). **Any feature that the current stack can't handle must be flagged to the user before it is built.**
