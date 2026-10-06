-- design-v2: practice circles and teacher meditations (design-v2 §9, tech/design-doc.md).
--
-- Access model: every table has row-level security on and NO policies, so the
-- browser (anon / authenticated keys) can't read or write tables directly.
-- Everything goes through the functions below, which return only what may be
-- shown. Phone numbers never leave the database except as the WhatsApp link a
-- visitor asks for (design-v2 §9: "not shown as text").
--
-- Times are Israel time. Election day: Tuesday 27.10.2026. All personal data is
-- deleted by 30.11.2026 (purge_personal_data, run by the worker).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- constants

create or replace function public.election_day() returns date
  language sql immutable as $$ select date '2026-10-27' $$;

create or replace function public.il_now() returns timestamp
  language sql stable as $$ select (now() at time zone 'Asia/Jerusalem') $$;

-- The map rectangle (design-v2 §9: a general area, not a border line).
create or replace function public.in_map_rect(lat double precision, lon double precision) returns boolean
  language sql immutable as $$ select lat between 29.40 and 33.40 and lon between 34.15 and 35.95 $$;

create or replace function public.km_between(lat1 double precision, lon1 double precision,
                                             lat2 double precision, lon2 double precision)
  returns double precision language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)))
$$;

-- ---------------------------------------------------------------- reference data

create table public.admins (
  phone text primary key  -- as Supabase stores it: digits with country code, no "+", e.g. 9725XXXXXXXX
);

create table public.localities (  -- CBS list (tech/tools/map/build_map_data.py)
  id   integer primary key,
  name text not null,
  lat  double precision not null,
  lon  double precision not null
);

create table public.land_rings (  -- Natural Earth land, buffered; only to block pins in the sea
  id serial primary key,
  xs double precision[] not null,  -- longitudes
  ys double precision[] not null   -- latitudes
);

create or replace function public.on_land(lat double precision, lon double precision) returns boolean
  language plpgsql stable as $$
declare r record; inside boolean; i int; j int; n int;
begin
  if not exists (select 1 from land_rings) then return true; end if;  -- no data loaded: don't block
  for r in select xs, ys from land_rings loop
    n := array_length(r.xs, 1); inside := false; j := n;
    for i in 1..n loop
      if ((r.ys[i] > lat) <> (r.ys[j] > lat)) and
         (lon < (r.xs[j] - r.xs[i]) * (lat - r.ys[i]) / (r.ys[j] - r.ys[i]) + r.xs[i]) then
        inside := not inside;
      end if;
      j := i;
    end loop;
    if inside then return true; end if;
  end loop;
  return false;
end $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where phone = coalesce(auth.jwt()->>'phone', '-'))
$$;

-- ---------------------------------------------------------------- circles

create table public.circles (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null,
  owner_phone  text not null,
  title        text not null check (char_length(title) between 3 and 60),
  description  text not null check (char_length(description) between 3 and 200),
  place_name   text not null check (char_length(place_name) between 2 and 80),
  locality_id  integer not null references public.localities (id),
  lat          double precision not null,
  lon          double precision not null,
  kind         text not null check (kind in ('once', 'weekly')),
  on_date      date,
  weekday      smallint check (weekday between 0 and 6),  -- 0 = Sunday (JS getDay)
  start_time   time not null,
  first_name   text check (char_length(first_name) <= 30),
  consents     jsonb not null,
  hidden       boolean not null default false,  -- 3 reports, or the founder
  needs_review boolean not null default false,  -- the AI text check could not run
  created_at   timestamptz not null default now(),
  check ((kind = 'once' and on_date is not null and weekday is null) or
         (kind = 'weekly' and weekday is not null and on_date is null))
);
create index on public.circles (owner_phone);

-- Every creation, kept even if the circle is deleted, for the daily limit.
create table public.circle_log (
  phone      text not null,
  created_at timestamptz not null default now()
);
create index on public.circle_log (phone, created_at);

create table public.circle_reports (
  circle_id     uuid not null references public.circles (id) on delete cascade,
  reporter_hash text not null,  -- salted hash of the reporter's IP, from the report-circle function
  reason        text check (char_length(reason) <= 300),
  created_at    timestamptz not null default now(),
  primary key (circle_id, reporter_hash)
);

-- Next date the circle meets (null when it no longer meets). A circle lasts
-- 30 minutes; it disappears once its last meeting has ended.
create or replace function public.circle_next_date(c public.circles) returns date
  language plpgsql stable as $$
declare today date := il_now()::date; now_t time := il_now()::time; d date;
begin
  if c.kind = 'once' then
    d := c.on_date;
  else
    d := today + ((c.weekday - extract(dow from today)::int + 7) % 7);
  end if;
  if d = today and c.start_time + interval '30 minutes' <= now_t then
    if c.kind = 'once' then return null; end if;
    d := d + 7;
  end if;
  if d < today or d > election_day() then return null; end if;
  return d;
end $$;

create or replace function public.circle_meets_on_election_day(c public.circles) returns boolean
  language sql stable as $$
  select (c.kind = 'once' and c.on_date = election_day()) or
         (c.kind = 'weekly' and c.weekday = extract(dow from election_day())::int)
$$;

-- What visitors may see of a circle: never the phone number.
create or replace function public.circle_public_json(c public.circles) returns jsonb
  language sql stable as $$
  select jsonb_build_object(
    'id', c.id, 'title', c.title, 'description', c.description, 'place_name', c.place_name,
    'locality_id', c.locality_id, 'locality', l.name, 'lat', c.lat, 'lon', c.lon,
    'kind', c.kind, 'on_date', c.on_date, 'weekday', c.weekday,
    'start_time', to_char(c.start_time, 'HH24:MI'), 'first_name', c.first_name,
    'next_date', circle_next_date(c), 'election_day', circle_meets_on_election_day(c))
  from localities l where l.id = c.locality_id
$$;

-- Checks shared by the form (dry run) and the real creation. Returns null when
-- everything is fine, or {"ok": false, "error": <code>, ...}. The site shows a
-- gentle Hebrew message for each code (assets/js/circles.js).
create or replace function public.circle_check(p_phone text, p jsonb) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  today date := il_now()::date; now_t time := il_now()::time;
  v_kind text := p->>'kind';
  v_date date; v_weekday int; v_time time;
  v_lat double precision; v_lon double precision; v_loc localities;
  v_text text := coalesce(p->>'title', '') || ' ' || coalesce(p->>'description', '') || ' ' ||
                 coalesce(p->>'place_name', '') || ' ' || coalesce(p->>'first_name', '');
begin
  -- Required fields and lengths
  if char_length(coalesce(p->>'title', '')) not between 3 and 60 then return '{"ok":false,"error":"title_length"}'; end if;
  if char_length(coalesce(p->>'description', '')) not between 3 and 200 then return '{"ok":false,"error":"description_length"}'; end if;
  if char_length(coalesce(p->>'place_name', '')) not between 2 and 80 then return '{"ok":false,"error":"place_length"}'; end if;
  if char_length(coalesce(p->>'first_name', '')) > 30 then return '{"ok":false,"error":"name_length"}'; end if;
  if v_kind not in ('once', 'weekly') then return '{"ok":false,"error":"kind"}'; end if;
  if not (coalesce((p->'consents'->>'public_place')::boolean, false) and
          coalesce((p->'consents'->>'rules')::boolean, false) and
          coalesce((p->'consents'->>'responsible')::boolean, false) and
          coalesce((p->'consents'->>'phone_visible')::boolean, false) and
          coalesce((p->'consents'->>'adult')::boolean, false)) then
    return '{"ok":false,"error":"consents"}';
  end if;

  -- Text: no links, no phone numbers (party names, candidates and offensive
  -- words are checked by the AI step in the create-circle function).
  if v_text ~* '(https?://|www\.|wa\.me|t\.me|bit\.ly|\m[a-z0-9-]+\.(com|co|il|org|net|io|me|ly|info|app)\M)' then
    return '{"ok":false,"error":"text_link"}';
  end if;
  if regexp_replace(v_text, '[\s\-\.\(\)/]', '', 'g') ~ '(\+?972|0)5\d{8}|\d{8,}' then
    return '{"ok":false,"error":"text_phone"}';
  end if;

  -- When
  begin
    v_time := (p->>'start_time')::time;
  exception when others then return '{"ok":false,"error":"time"}';
  end;
  if v_time < time '06:00' or v_time > time '21:30' or extract(minute from v_time)::int % 15 <> 0
     or extract(second from v_time) <> 0 then
    return '{"ok":false,"error":"time"}';
  end if;
  if v_kind = 'once' then
    begin
      v_date := (p->>'on_date')::date;
    exception when others then return '{"ok":false,"error":"date"}';
    end;
    if v_date is null or v_date < today or v_date > election_day() then return '{"ok":false,"error":"date"}'; end if;
    if v_date = today and v_time <= now_t then return '{"ok":false,"error":"time_past"}'; end if;
    if v_date = election_day() and v_time < time '07:00' then return '{"ok":false,"error":"election_day_hours"}'; end if;
  else
    v_weekday := (p->>'weekday')::int;
    if v_weekday is null or v_weekday not between 0 and 6 then return '{"ok":false,"error":"weekday"}'; end if;
    if v_weekday = extract(dow from election_day())::int and v_time < time '07:00' then
      return '{"ok":false,"error":"election_day_hours"}';
    end if;
    if today + ((v_weekday - extract(dow from today)::int + 7) % 7) > election_day() then
      return '{"ok":false,"error":"date"}';
    end if;
  end if;

  -- Where
  v_lat := (p->>'lat')::double precision; v_lon := (p->>'lon')::double precision;
  if v_lat is null or v_lon is null or not in_map_rect(v_lat, v_lon) then return '{"ok":false,"error":"outside_map"}'; end if;
  if not on_land(v_lat, v_lon) then return '{"ok":false,"error":"in_sea"}'; end if;
  select * into v_loc from localities where id = (p->>'locality_id')::int;
  if not found then return '{"ok":false,"error":"locality"}'; end if;
  if km_between(v_lat, v_lon, v_loc.lat, v_loc.lon) > 8 and
     not coalesce((p->>'confirm_far')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'far_from_locality', 'warning', true, 'locality', v_loc.name);
  end if;

  -- Limits and duplicates (only with a verified phone)
  if p_phone is not null then
    if (select count(*) from circle_log
        where phone = p_phone and (created_at at time zone 'Asia/Jerusalem')::date = today) >= 2 then
      return '{"ok":false,"error":"daily_limit"}';
    end if;
    if exists (select 1 from circles c
               where c.owner_phone = p_phone and c.start_time = v_time
                 and km_between(c.lat, c.lon, v_lat, v_lon) < 0.3
                 and ((v_kind = 'once' and c.on_date = v_date) or (v_kind = 'weekly' and c.weekday = v_weekday))) then
      return '{"ok":false,"error":"duplicate"}';
    end if;
  end if;
  return null;
end $$;

-- Called only by the create-circle edge function (service role), after it has
-- verified the user's phone session and run the AI text check.
create or replace function public.create_circle_as(p_owner uuid, p_phone text, p jsonb,
                                                   p_dry_run boolean default false,
                                                   p_needs_review boolean default false)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare err jsonb; v_id uuid;
begin
  if p_owner is null or coalesce(p_phone, '') = '' then return '{"ok":false,"error":"auth"}'; end if;
  err := circle_check(p_phone, p);
  if err is not null then return err; end if;
  if p_dry_run then return '{"ok":true,"dry_run":true}'; end if;
  insert into circles (owner_id, owner_phone, title, description, place_name, locality_id, lat, lon,
                       kind, on_date, weekday, start_time, first_name, consents, needs_review)
  values (p_owner, p_phone, trim(p->>'title'), trim(p->>'description'), trim(p->>'place_name'),
          (p->>'locality_id')::int, (p->>'lat')::double precision, (p->>'lon')::double precision,
          p->>'kind',
          case when p->>'kind' = 'once' then (p->>'on_date')::date end,
          case when p->>'kind' = 'weekly' then (p->>'weekday')::smallint end,
          (p->>'start_time')::time, nullif(trim(coalesce(p->>'first_name', '')), ''), p->'consents',
          p_needs_review)
  returning id into v_id;
  insert into circle_log (phone) values (p_phone);
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Form-side dry run for a signed-in user (same checks, nothing saved).
create or replace function public.check_circle(p jsonb) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare err jsonb;
begin
  err := circle_check(auth.jwt()->>'phone', p);
  return coalesce(err, '{"ok":true}');
end $$;

create or replace function public.list_circles() returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(j order by j->>'next_date', j->>'start_time'), '[]')
  from (select circle_public_json(c) j from circles c where not c.hidden) s
  where j->>'next_date' is not null
$$;

create or replace function public.get_circle(p_id uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select circle_public_json(c) from circles c where c.id = p_id and not c.hidden
$$;

create or replace function public.election_day_circle_count() returns integer
  language sql stable security definer set search_path = public as $$
  select count(*)::int from circles c
  where not c.hidden and circle_meets_on_election_day(c) and circle_next_date(c) is not null
$$;

-- "לתאם בוואטסאפ": the link is built only when a visitor asks for it, so the
-- number is never part of the page (design-v2 §9).
create or replace function public.url_encode(t text) returns text
  language sql immutable as $$
  select string_agg(case when ch ~ '^[A-Za-z0-9_.~-]$' then ch
                         else upper(regexp_replace(encode(convert_to(ch, 'UTF8'), 'hex'), '(..)', '%\1', 'g')) end, '' order by i)
  from regexp_split_to_table(t, '') with ordinality as x(ch, i)
$$;

create or replace function public.circle_whatsapp_link(p_id uuid) returns text
  language sql stable security definer set search_path = public as $$
  select 'https://wa.me/' || regexp_replace(c.owner_phone, '\D', '', 'g') || '?text=' ||
         url_encode('היי, ראיתי את המעגל "' || c.title || '" באתר נוֹכְחִים ואשמח להצטרף')
  from circles c where c.id = p_id and not c.hidden and circle_next_date(c) is not null
$$;

create or replace function public.my_circles() returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(circle_public_json(c) || jsonb_build_object('hidden', c.hidden)
                            order by c.created_at desc), '[]')
  from circles c where c.owner_phone = auth.jwt()->>'phone'
$$;

-- Deleting needs a fresh code to the same number: the browser holds a session
-- only after verifying the phone.
create or replace function public.delete_my_circle(p_id uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  delete from circles where id = p_id and owner_phone = auth.jwt()->>'phone';
  return found;
end $$;

-- Called only by the report-circle edge function (Turnstile + IP hash).
create or replace function public.report_circle_as(p_id uuid, p_reporter_hash text, p_reason text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from circles where id = p_id) then return '{"ok":false,"error":"not_found"}'; end if;
  insert into circle_reports (circle_id, reporter_hash, reason)
  values (p_id, p_reporter_hash, left(nullif(trim(coalesce(p_reason, '')), ''), 300))
  on conflict do nothing;
  select count(*) into n from circle_reports where circle_id = p_id;
  if n >= 3 then update circles set hidden = true where id = p_id; end if;  -- hidden until the founder checks it
  return '{"ok":true}';
end $$;

-- ---------------------------------------------------------------- teacher meditations

create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null,
  owner_phone   text,  -- nulled by purge_personal_data
  teacher_name  text not null check (char_length(teacher_name) between 2 and 60),
  bio           text check (char_length(bio) <= 120),
  title         text not null check (char_length(title) between 2 and 60),
  description   text not null check (char_length(description) between 3 and 240),
  add_music     boolean not null default false,
  audio_path    text not null,  -- private bucket "submissions"
  photo_path    text not null,
  consents      jsonb not null,
  status        text not null default 'uploaded'
                check (status in ('uploaded', 'processing', 'review', 'approved', 'published', 'rejected', 'failed', 'removed')),
  status_note   text,
  duration_sec  integer,
  transcript    text,
  ai_review     jsonb,  -- {relevance, violations[], summary} from the worker
  mixed_path    text,   -- the version that gets published (with music if asked)
  public_audio  text,   -- URL in the public "media" bucket, once published
  public_photo  text,
  tags          text[] not null default '{}',  -- home / way / sleep, set by the founder
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  published_at  timestamptz
);
create index on public.submissions (status);

create or replace function public.submit_meditation(p jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_phone text := auth.jwt()->>'phone'; v_id uuid;
begin
  if v_uid is null or coalesce(v_phone, '') = '' then return '{"ok":false,"error":"auth"}'; end if;
  if char_length(coalesce(p->>'teacher_name', '')) not between 2 and 60 then return '{"ok":false,"error":"name_length"}'; end if;
  if char_length(coalesce(p->>'bio', '')) > 120 then return '{"ok":false,"error":"bio_length"}'; end if;
  if char_length(coalesce(p->>'title', '')) not between 2 and 60 then return '{"ok":false,"error":"title_length"}'; end if;
  if char_length(coalesce(p->>'description', '')) not between 3 and 240 then return '{"ok":false,"error":"description_length"}'; end if;
  if not (coalesce((p->'consents'->>'rights')::boolean, false) and
          coalesce((p->'consents'->>'license')::boolean, false) and
          coalesce((p->'consents'->>'publish_profile')::boolean, false) and
          coalesce((p->'consents'->>'rules')::boolean, false) and
          coalesce((p->'consents'->>'adult')::boolean, false)) then
    return '{"ok":false,"error":"consents"}';
  end if;
  -- Files must already be in the user's own folder (the storage policy only lets them write there).
  if split_part(p->>'audio_path', '/', 1) <> v_uid::text or split_part(p->>'photo_path', '/', 1) <> v_uid::text
     or not exists (select 1 from storage.objects where bucket_id = 'submissions' and name = p->>'audio_path')
     or not exists (select 1 from storage.objects where bucket_id = 'submissions' and name = p->>'photo_path') then
    return '{"ok":false,"error":"files"}';
  end if;
  if (select count(*) from submissions where owner_phone = v_phone
      and created_at > now() - interval '1 day') >= 5 then
    return '{"ok":false,"error":"daily_limit"}';
  end if;
  insert into submissions (owner_id, owner_phone, teacher_name, bio, title, description, add_music,
                           audio_path, photo_path, consents)
  values (v_uid, v_phone, trim(p->>'teacher_name'), nullif(trim(coalesce(p->>'bio', '')), ''),
          trim(p->>'title'), trim(p->>'description'), coalesce((p->>'add_music')::boolean, false),
          p->>'audio_path', p->>'photo_path', p->'consents')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.list_meditations() returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'teacher_name', s.teacher_name, 'bio', s.bio, 'title', s.title,
    'description', s.description, 'duration_sec', s.duration_sec, 'audio', s.public_audio,
    'photo', s.public_photo, 'tags', s.tags, 'published_at', s.published_at)
    order by s.published_at desc), '[]')
  from submissions s where s.status = 'published'
$$;

-- ---------------------------------------------------------------- admin (the founder)

create or replace function public.admin_overview() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not admin' using errcode = '42501'; end if;
  return jsonb_build_object(
    'submissions', (select coalesce(jsonb_agg(to_jsonb(s) - 'owner_phone' - 'owner_id' order by s.created_at desc), '[]')
                    from submissions s where s.status not in ('removed')),
    'circles', (select coalesce(jsonb_agg(circle_public_json(c) || jsonb_build_object(
                  'hidden', c.hidden, 'needs_review', c.needs_review, 'created_at', c.created_at,
                  'reports', (select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'at', r.created_at)), '[]')
                              from circle_reports r where r.circle_id = c.id))
                  order by c.hidden desc, c.needs_review desc, c.created_at desc), '[]')
                from circles c));
end $$;

create or replace function public.admin_review_submission(p_id uuid, p_approve boolean,
                                                          p_note text default null, p_tags text[] default '{}')
  returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not admin' using errcode = '42501'; end if;
  update submissions
     set status = case when p_approve then 'approved' else 'rejected' end,  -- the worker publishes 'approved'
         status_note = p_note,
         tags = coalesce((select array_agg(t) from unnest(p_tags) t where t in ('home', 'way', 'sleep')), '{}'),
         reviewed_at = now()
   where id = p_id and status in ('review', 'failed', 'rejected');
  return found;
end $$;

create or replace function public.admin_remove_meditation(p_id uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not admin' using errcode = '42501'; end if;
  update submissions set status = 'removed', reviewed_at = now()
   where id = p_id and status in ('approved', 'published');  -- the worker deletes the public files
  return found;
end $$;

create or replace function public.admin_set_circle_hidden(p_id uuid, p_hidden boolean) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not admin' using errcode = '42501'; end if;
  update circles set hidden = p_hidden, needs_review = false where id = p_id;
  if not p_hidden then delete from circle_reports where circle_id = p_id; end if;  -- checked and fine: start over
  return found;
end $$;

create or replace function public.admin_delete_circle(p_id uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not admin' using errcode = '42501'; end if;
  delete from circles where id = p_id;
  return found;
end $$;

-- ---------------------------------------------------------------- retention

-- Run by the worker on 30.11.2026 (design-v2 §9). Published meditations stay
-- (name, photo, sentence, audio), without the phone number.
create or replace function public.purge_personal_data() returns jsonb
  language plpgsql security definer set search_path = public as $$
declare n_c int; n_s int;
begin
  delete from circle_reports;
  delete from circle_log;
  delete from circles; get diagnostics n_c = row_count;
  delete from submissions where status <> 'published'; get diagnostics n_s = row_count;
  update submissions set owner_phone = null;
  return jsonb_build_object('circles_deleted', n_c, 'submissions_deleted', n_s);
end $$;

-- ---------------------------------------------------------------- access

alter table public.admins enable row level security;
alter table public.localities enable row level security;
alter table public.land_rings enable row level security;
alter table public.circles enable row level security;
alter table public.circle_log enable row level security;
alter table public.circle_reports enable row level security;
alter table public.submissions enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Everyone (signed in or not)
grant execute on function public.list_circles(), public.get_circle(uuid), public.election_day_circle_count(),
  public.circle_whatsapp_link(uuid), public.list_meditations() to anon, authenticated;
-- Visitors who verified their phone
grant execute on function public.check_circle(jsonb), public.my_circles(), public.delete_my_circle(uuid),
  public.submit_meditation(jsonb), public.is_admin() to authenticated;
-- The founder (each function checks is_admin itself)
grant execute on function public.admin_overview(), public.admin_review_submission(uuid, boolean, text, text[]),
  public.admin_remove_meditation(uuid), public.admin_set_circle_hidden(uuid, boolean),
  public.admin_delete_circle(uuid) to authenticated;
-- Edge functions and the worker use the service role, which keeps full access.
grant execute on all functions in schema public to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Localities are public data; the site also ships them as a static file.
grant select on public.localities to anon, authenticated;
create policy "localities are public" on public.localities for select using (true);

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('submissions', 'submissions', false, 52428800,  -- 50 MB: originals from teachers (private)
   array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/webm',
         'audio/wav', 'audio/x-wav', 'audio/wave', 'video/mp4', 'image/jpeg', 'image/png', 'image/webp']),
  ('media', 'media', true, 52428800,  -- published audio and photos (public read, written by the worker)
   array['audio/mpeg', 'image/jpeg', 'application/json'])
on conflict (id) do nothing;

create policy "teachers upload into their own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "the founder can listen to submissions" on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and public.is_admin());
