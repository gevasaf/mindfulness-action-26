# mindfulness-action-26

A grassroots movement and its website. The site is built in iterations by two kinds of Claude chat:

- **Design & ideation (עיצוב ורעיונות):** in Hebrew. Develops the design philosophy in `design/`.
- **Stack & building:** turns each design release into a tech doc (`tech/`) and the website (`site/`).

```
design/      Hebrew design philosophy: living draft, notes, frozen releases
tech/        Technical design doc, stack, questions for design
site/        The website (static, GitHub Pages)
agents/      Role instructions for each kind of chat
ITERATIONS.md  Handoff table: design release → tech doc → live site
```

Start any chat by saying which kind it is, or Claude will ask. See [`CLAUDE.md`](CLAUDE.md) for the workflow and [`tech/stack.md`](tech/stack.md) for the stack and what would require changing it.

**One-time setup:** go to Settings → Pages → Source and choose **GitHub Actions**.
