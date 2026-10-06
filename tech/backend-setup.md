# Backend setup (circles, teacher meditations, admin)

What the repo owner sets up so the design-v2 features can go live. The site
stays on GitHub Pages; these services sit next to it (stack decisions F4–F9 in
[`stack.md`](stack.md)). Until step 9 the site works exactly as v1: everything
that needs the server stays hidden.

**Never paste a secret key into a chat, an issue or a file in this repo.** The
repo is public. Secrets go only into the Supabase and GitHub settings pages
named below. Only three values are public and go into `site/assets/js/config.js`:
the Supabase URL, the Supabase *anon* key and the Turnstile *site* key.

Rough time: about an hour. Rough cost until 30.11: SMS ~$40–120, everything
else free or a few dollars (see `stack.md`).

---

## 1. Supabase project

1. Sign up at supabase.com and create a project. Region: **Frankfurt
   (eu-central-1)**, the closest to Israel. Keep the database password somewhere safe.
2. **Project Settings → API**: note the **Project URL**, the **anon public**
   key (public) and the **service_role** key (secret).
3. Free plan: a project with no activity for 7 days is paused. During
   October–November there will be activity, but the Pro plan (~$25/month)
   removes the risk and raises the 5 GB monthly transfer limit. Decide when you
   see real usage; it can be switched any time.

## 2. Database

Either way works:

- **Supabase CLI** (from a clone of this repo):
  ```
  npx supabase login
  npx supabase link --project-ref <your project ref>
  npx supabase db push
  ```
- **Or the SQL Editor** in the dashboard: paste and run, in order,
  `supabase/migrations/20261006000000_circles_and_teachers.sql` and then
  `supabase/migrations/20261006000100_map_data.sql`.

This creates the tables, the functions, the two storage buckets (`submissions`,
private; `media`, public) and the list of localities.

Then make yourself the admin (SQL Editor). The number is written the way
Supabase stores it: country code, no plus, no leading zero:
```sql
insert into public.admins (phone) values ('9725XXXXXXXX');  -- your mobile, e.g. 050-1234567 -> 972501234567
```

## 3. SMS codes: Twilio Verify

1. Sign up at twilio.com. Upgrade from trial (a trial only texts verified numbers).
2. **Verify → Services → Create**: name it "נוכחים", code length 6. Note the
   **Service SID** (starts with VA).
3. Note the **Account SID** and **Auth Token** (Console home).
4. **Messaging → Settings → Geo permissions**: allow **Israel** only. This
   blocks SMS-pumping fraud to other countries.
5. **Billing**: set a monthly usage limit or alert (e.g. $100).

## 4. Bot protection: Cloudflare Turnstile

1. Sign up at cloudflare.com (free) → **Turnstile → Add widget**.
2. Hostnames: `gevasaf.github.io` (and `localhost` for testing). Mode: **Managed**.
3. Note the **Site key** (public) and the **Secret key** (secret).

## 5. Supabase Auth settings

In the Supabase dashboard:

1. **Authentication → Sign In / Providers → Phone**: enable. SMS provider:
   **Twilio Verify**. Paste the Account SID, Auth Token and Verify Service SID.
   Leave email sign-in off (the project stores no email addresses).
2. **Authentication → Attack Protection** (bot and abuse protection): enable
   **CAPTCHA protection**, provider **Turnstile**, paste the Turnstile **secret** key.
3. **Authentication → Rate Limits**: SMS messages per hour, e.g. 30. (Each
   number can already ask for a code only once a minute.)
4. **Authentication → URL Configuration**: Site URL
   `https://gevasaf.github.io/mindfulness-action-26/`.
5. Sessions: keep the defaults. A verified phone stays signed in on that browser
   (so it doesn't need another SMS) until it signs out; everything is deleted on 30.11.

## 6. Edge functions (open a circle, report a circle)

From a clone of the repo, with the CLI linked (step 2):
```
npx supabase functions deploy create-circle
npx supabase functions deploy report-circle
npx supabase secrets set ANTHROPIC_API_KEY=... TURNSTILE_SECRET=... REPORT_SALT=<a long random string> SITE_ORIGINS=https://gevasaf.github.io
```
(Or set the same four in the dashboard: **Edge Functions → Secrets**.)
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the functions
automatically.

The Anthropic key: console.anthropic.com → API keys. It checks circle texts
(create-circle) and rates teacher recordings (the worker). Set a monthly spend
limit there too (e.g. $20); expected use is a few dollars.

## 7. Transcription: ElevenLabs

elevenlabs.io → API keys → create a key with **Speech to Text** permission
only. It transcribes teacher recordings so they can be rated and read before
approval. If you'd rather skip it, the worker still runs: you listen and
approve without a transcript or AI rating.

## 8. GitHub Actions secrets (the recordings worker)

Repo **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key from step 1 |
| `ELEVENLABS_API_KEY` | from step 7 |
| `ANTHROPIC_API_KEY` | from step 6 |

The workflow `.github/workflows/recordings-worker.yml` runs every 10 minutes
on `main` and does nothing until these exist.

## 9. Tell the build chat the three public values

Send only: the **Project URL**, the **anon** key and the Turnstile **site** key.
The build chat puts them in `site/assets/js/config.js`, tests every flow against
the real services, and merges to `main`. From that moment the circles map, the
open-a-circle form, the teachers page and `admin.html` are live.

## Before launch

- A lawyer reviews the consent texts (design-v2 §13): the teacher upload
  consents (`site/teachers.html`) and the circle consents (`site/open-circle.html`),
  plus the privacy page (`site/privacy.html`).
- Try it yourself: open a test circle, delete it, upload a short test
  recording, approve it in `admin.html`, then remove it.

## After the elections

On and after 30.11.2026 the worker deletes all phone numbers, circles,
reports, unpublished recordings and sign-in accounts by itself
(`purge_personal_data`). Published teacher meditations stay. After that you can
downgrade or close the Twilio and ElevenLabs accounts.

## Local testing (for the build chat)

`tech/tools/supabase/test.sh` runs the database tests on a local Postgres.
`tech/tools/supabase/mock_server.py` imitates the Supabase APIs on
`localhost:54321` (any number, code 123456) so the pages can be tried in a
browser without a real project; see the comments at the top of each file.
