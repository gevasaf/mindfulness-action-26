# Archived: design-v2 (dropped 2026-10-07)

design-v2 added server features on top of the live v1 site: teachers upload meditations (phone verification, AI rating, manual approval, optional background music), and practice circles with a map, schedule, phone verification and reports. The backend was Supabase, Twilio Verify, Turnstile, a GitHub Actions recording worker and a self-hosted map (`tech/stack.md`, F4–F9).

It was built but never tested against real services or published. On 2026-10-07 the user dropped this direction to redesign from v1. It is kept here only as reference: **nothing in this folder is a current requirement.**

| What | Where |
|---|---|
| The v2 design doc (Hebrew), as it was when the direction was dropped | [`design.html`](design.html) |
| The v2 content (host kit, teachers page, meditation scripts) | [`content/`](content/) |
| The v2 tech doc (t3.0) | [`tech-design-doc.md`](tech-design-doc.md) |
| Backend account setup guide | [`backend-setup.md`](backend-setup.md) |
| **All the v2 code** (database and tests, edge functions, recording worker, map data, front end) | The **`archive/v2`** branch: `git checkout archive/v2` |

Links inside these files point to paths as they were on that branch.
