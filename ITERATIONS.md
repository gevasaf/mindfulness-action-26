# Iterations / איטרציות

The handoff point between the design and build chats.

- **Design chat:** when you release `design-vN`, add a row with status `ready-to-build`.
- **Build chat:** fill in the rest of that row, moving the status from `building` to `live`.

Statuses: `ready-to-build` → `building` → `live`

| Iteration | Design release | Released | Tech doc | Site live | Status | Notes |
|---|---|---|---|---|---|---|
| 0 | — | — | t0 | — | scaffold | Placeholder site, no design yet |
| 0-draft | design-v0 | 2026-10-06 | t1.2.8 | 2026-10-06 | live | Draft prototype, public but not yet promoted (see questions-for-design #1); ElevenLabs sample meditations; previews of future features. Site v0.2 (approved) adds the user's direct design remarks (questions-for-design #6); now at v0.2.7, still a draft |
| 1 | design-v1 | 2026-10-06 | | | ready-to-build | Public launch. Stage A today (drop draft marks and removed pages); stage B (teacher uploads, circles map) needs a stack change, flag first |
| 2 | design-v2 | 2026-10-06 | | | ready-to-build | Small update to v1: circles via phone verification and direct WhatsApp (no groups), no emails stored, election day as the circles' peak day, About names the founder. Stage A of v1 unchanged |
| 3 | design-v3 | 2026-10-06 | | | ready-to-build | Small update to stage B: circles publish without manual approval (phone verification, max 2 new per number per day, automatic sanity checks, reports hide after 3); teachers cannot self-remove, phones never public |
