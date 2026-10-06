# Iterations / איטרציות

The handoff point between the design and build chats.

- **Design chat:** when you release `design-vN`, add a row with status `ready-to-build`.
- **Build chat:** fill in the rest of that row, moving the status from `building` to `live`.

Statuses: `ready-to-build` → `building` → `live`

| Iteration | Design release | Released | Tech doc | Site live | Status | Notes |
|---|---|---|---|---|---|---|
| 0 | — | — | t0 | — | scaffold | Placeholder site, no design yet |
| 0-draft | design-v0 | 2026-10-06 | t1.2.8 | 2026-10-06 | live | Draft prototype, public but not yet promoted (see questions-for-design #1); ElevenLabs sample meditations; previews of future features. Site v0.2 (approved) adds the user's direct design remarks (questions-for-design #6); now at v0.2.7, still a draft |
| 1 | design-v1 | 2026-10-06 | t2.0 | 2026-10-06 | live | Public launch, no server: drop draft marks and removed pages, add "the idea" section, About (Assaf Geva), detailed host kit. Build today. Site v1.0.1 live (brand font and niqqud, question #11); waiting for the user's test and notes (A7, A8, questions-for-design #10) |
| 2 | design-v2 | 2026-10-06 | | | ready-to-build | Needs a server (flag first): teacher uploads with phone verification and manual approval; circles with phone verification, map and schedule, direct WhatsApp, sanity checks, reports. Build right after v1 |
