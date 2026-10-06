-- Tests for the circles and teachers migration (design-v2), on plain Postgres with stub_supabase.sql.
-- Run: tech/tools/supabase/test.sh   (fails on the first broken expectation)
\set ON_ERROR_STOP 1
set client_min_messages = notice;

create or replace function pg_temp.expect(label text, got jsonb, want text) returns void language plpgsql as $$
begin
  if coalesce(got->>'error', 'ok') <> want then
    raise exception 'FAIL %: expected %, got %', label, want, got;
  end if;
  raise notice 'ok  %', label;
end $$;

-- Reference data: two localities, a land square around them (no sea there).
insert into localities values (1, 'מקום א', 32.08, 34.78), (2, 'מקום ב', 31.25, 34.79), (3, 'מקום בלי נקודה', null, null);
insert into land_rings (xs, ys) values (array[34.70, 35.90, 35.90, 34.70, 34.70], array[29.50, 29.50, 33.30, 33.30, 29.50]);
insert into admins values ('972500000009');

-- A valid circle, written as the form sends it.
create temp table base as select jsonb_build_object(
  'title', 'מעגל נשימה בגינה', 'description', 'חצי שעה של שקט, מתאים גם למי שלא תרגל',
  'place_name', 'הדשא ליד הספרייה', 'locality_id', 1, 'lat', 32.081, 'lon', 34.781,
  'kind', 'once', 'on_date', (il_now()::date + 3)::text, 'start_time', '08:30', 'first_name', 'נועה',
  'consents', jsonb_build_object('public_place', true, 'rules', true, 'responsible', true, 'phone_visible', true, 'adult', true)) p;
grant select on base to anon, authenticated;

do $$
declare b jsonb := (select p from base); u uuid := gen_random_uuid(); r jsonb; id1 uuid;
begin
  perform pg_temp.expect('valid circle, dry run', create_circle_as(u, '972501111111', b, true), 'ok');
  perform pg_temp.expect('no phone', create_circle_as(u, '', b), 'auth');
  perform pg_temp.expect('title too short', create_circle_as(u, '972501111111', b || '{"title":"א"}'), 'title_length');
  perform pg_temp.expect('description too long', create_circle_as(u, '972501111111', b || jsonb_build_object('description', repeat('א', 201))), 'description_length');
  perform pg_temp.expect('missing consent', create_circle_as(u, '972501111111', b || '{"consents":{"public_place":true}}'), 'consents');
  perform pg_temp.expect('link in text', create_circle_as(u, '972501111111', b || '{"description":"פרטים ב www.example.com"}'), 'text_link');
  perform pg_temp.expect('domain in text', create_circle_as(u, '972501111111', b || '{"description":"פרטים באתר example.co.il"}'), 'text_link');
  perform pg_temp.expect('phone in text', create_circle_as(u, '972501111111', b || '{"description":"להתקשר 050-123-4567"}'), 'text_phone');
  perform pg_temp.expect('time not on a quarter', create_circle_as(u, '972501111111', b || '{"start_time":"08:10"}'), 'time');
  perform pg_temp.expect('too early', create_circle_as(u, '972501111111', b || '{"start_time":"05:45"}'), 'time');
  perform pg_temp.expect('too late (ends after 22:00)', create_circle_as(u, '972501111111', b || '{"start_time":"21:45"}'), 'time');
  perform pg_temp.expect('21:30 is the last start', create_circle_as(u, '972501111111', b || '{"start_time":"21:30"}', true), 'ok');
  perform pg_temp.expect('date in the past', create_circle_as(u, '972501111111', b || jsonb_build_object('on_date', (il_now()::date - 1)::text)), 'date');
  perform pg_temp.expect('date after election day', create_circle_as(u, '972501111111', b || '{"on_date":"2026-10-28"}'), 'date');
  perform pg_temp.expect('election day 06:30', create_circle_as(u, '972501111111', b || '{"on_date":"2026-10-27","start_time":"06:30"}'), 'election_day_hours');
  perform pg_temp.expect('election day 07:00', create_circle_as(u, '972501111111', b || '{"on_date":"2026-10-27","start_time":"07:00"}', true), 'ok');
  perform pg_temp.expect('weekly on Tuesday 06:30', create_circle_as(u, '972501111111', b || '{"kind":"weekly","weekday":2,"start_time":"06:30"}'), 'election_day_hours');
  perform pg_temp.expect('weekly Monday 06:30', create_circle_as(u, '972501111111', b || '{"kind":"weekly","weekday":1,"start_time":"06:30"}', true), 'ok');
  perform pg_temp.expect('outside the rectangle', create_circle_as(u, '972501111111', b || '{"lat":34.5,"lon":35.0}'), 'outside_map');
  perform pg_temp.expect('in the sea', create_circle_as(u, '972501111111', b || '{"lat":32.08,"lon":34.50}'), 'in_sea');
  perform pg_temp.expect('unknown locality', create_circle_as(u, '972501111111', b || '{"locality_id":99}'), 'locality');
  perform pg_temp.expect('far from locality warns', create_circle_as(u, '972501111111', b || '{"locality_id":2}'), 'far_from_locality');
  perform pg_temp.expect('locality without coordinates: no distance check', create_circle_as(u, '972501111111', b || '{"locality_id":3}', true), 'ok');
  perform pg_temp.expect('far, confirmed', create_circle_as(u, '972501111111', b || '{"locality_id":2,"confirm_far":true}', true), 'ok');

  r := create_circle_as(u, '972501111111', b);
  perform pg_temp.expect('create #1', r, 'ok');
  id1 := (r->>'id')::uuid;
  perform pg_temp.expect('duplicate', create_circle_as(u, '972501111111', b || '{"lat":32.0815}'), 'duplicate');
  perform pg_temp.expect('create #2 (weekly)', create_circle_as(u, '972501111111', b || '{"kind":"weekly","weekday":0,"start_time":"19:00"}'), 'ok');
  perform pg_temp.expect('third today', create_circle_as(u, '972501111111', b || '{"start_time":"10:00"}'), 'daily_limit');
  perform pg_temp.expect('other phone, same spot', create_circle_as(gen_random_uuid(), '972502222222', b || '{"on_date":"2026-10-27","start_time":"07:30"}'), 'ok');

  -- Reports: 3 different reporters hide the circle; the same reporter twice counts once.
  perform report_circle_as(id1, 'h1'); perform report_circle_as(id1, 'h1'); perform report_circle_as(id1, 'h2');
  if (select hidden from circles where id = id1) then raise exception 'FAIL hidden after 2 reporters'; end if;
  perform report_circle_as(id1, 'h3');
  if not (select hidden from circles where id = id1) then raise exception 'FAIL not hidden after 3 reporters'; end if;
  raise notice 'ok  3 separate reports hide a circle';
  if get_circle(id1) is not null then raise exception 'FAIL hidden circle still visible'; end if;
  raise notice 'ok  hidden circle is not public';
end $$;

-- What anonymous visitors can and can't do.
set role anon;
do $$
declare j jsonb := list_circles(); link text;
begin
  if jsonb_array_length(j) <> 2 then raise exception 'FAIL list_circles count %', jsonb_array_length(j); end if;
  if j::text like '%9725%' then raise exception 'FAIL phone number in public list'; end if;
  raise notice 'ok  public list has no phone numbers';
  if election_day_circle_count() <> 1 then raise exception 'FAIL election day count %', election_day_circle_count(); end if;
  raise notice 'ok  election day counter';
  link := circle_whatsapp_link((j->0->>'id')::uuid);
  if link not like 'https://wa.me/97250%?text=%D7%94%D7%99%D7%99%2C%20%D7%A8%D7%90%D7%99%D7%AA%D7%99%20%D7%90%D7%AA%20%D7%94%D7%9E%D7%A2%D7%92%D7%9C%20%22%' then
    raise exception 'FAIL whatsapp link %', link;
  end if;
  raise notice 'ok  WhatsApp link is built on request';
  begin
    perform * from circles;
    raise exception 'FAIL anon can read circles';
  exception when insufficient_privilege then raise notice 'ok  anon cannot read tables';
  end;
  begin
    perform create_circle_as(gen_random_uuid(), '972503333333', '{}'::jsonb);
    raise exception 'FAIL anon can call create_circle_as';
  exception when insufficient_privilege then raise notice 'ok  anon cannot create circles directly';
  end;
  begin
    perform admin_overview();
    raise exception 'FAIL anon can call admin_overview';
  exception when insufficient_privilege then raise notice 'ok  anon cannot call admin functions';
  end;
end $$;
reset role;

-- A signed-in visitor: their own circles, delete, and no admin rights.
select null from (select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","phone":"972501111111"}', false)) x;
set role authenticated;
do $$
declare mine jsonb := my_circles(); other uuid;
begin
  if jsonb_array_length(mine) <> 2 then raise exception 'FAIL my_circles %', jsonb_array_length(mine); end if;
  raise notice 'ok  my circles';
  perform pg_temp.expect('check_circle: daily limit applies', check_circle((select p from base) || '{"start_time":"11:00"}'), 'daily_limit');
  begin
    perform admin_overview();
    raise exception 'FAIL non-admin got admin_overview';
  exception when insufficient_privilege then raise notice 'ok  non-admin is refused';
  end;
end $$;
reset role;
do $$
declare other uuid := (select id from circles where owner_phone = '972502222222');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","phone":"972501111111"}', false);
  if delete_my_circle(other) then raise exception 'FAIL deleted someone else''s circle'; end if;
  raise notice 'ok  cannot delete someone else''s circle';
  if not delete_my_circle((select id from circles where owner_phone = '972501111111' and kind = 'weekly')) then
    raise exception 'FAIL could not delete own circle';
  end if;
  raise notice 'ok  delete own circle';
end $$;

-- Teacher submission: files must be in the user's own folder.
insert into storage.objects (bucket_id, name) values
  ('submissions', '00000000-0000-0000-0000-000000000001/a.m4a'),
  ('submissions', '00000000-0000-0000-0000-000000000001/p.jpg'),
  ('submissions', '00000000-0000-0000-0000-000000000002/x.m4a');
set role authenticated;
do $$
declare s jsonb := jsonb_build_object('teacher_name', 'דנה', 'bio', 'מורה למדיטציה', 'title', 'לעכל',
  'description', 'עשר דקות לתת מקום למה שעבר', 'add_music', true,
  'audio_path', '00000000-0000-0000-0000-000000000001/a.m4a', 'photo_path', '00000000-0000-0000-0000-000000000001/p.jpg',
  'consents', jsonb_build_object('rights', true, 'license', true, 'publish_profile', true, 'rules', true, 'adult', true));
begin
  perform pg_temp.expect('submission with someone else''s file', submit_meditation(s || '{"audio_path":"00000000-0000-0000-0000-000000000002/x.m4a"}'), 'files');
  perform pg_temp.expect('submission missing consent', submit_meditation(s || '{"consents":{}}'), 'consents');
  perform pg_temp.expect('submission ok', submit_meditation(s), 'ok');
  if jsonb_array_length(list_meditations()) <> 0 then raise exception 'FAIL unreviewed meditation is public'; end if;
  raise notice 'ok  nothing is public before approval';
end $$;
reset role;

-- The founder reviews; the worker publishes.
select null from (select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000009","phone":"972500000009"}', false)) x;
update submissions set status = 'review';
set role authenticated;
do $$
declare sid uuid; o jsonb := admin_overview();
begin
  if o::text like '%972501111111%' then raise exception 'FAIL phone in admin overview'; end if;
  raise notice 'ok  admin overview has no phone numbers';
  sid := (o->'submissions'->0->>'id')::uuid;
  if not admin_review_submission(sid, true, null, array['home', 'bogus']) then raise exception 'FAIL approve'; end if;
  raise notice 'ok  founder approves';
end $$;
reset role;
update submissions set status = 'published', public_audio = 'https://x/a.mp3', published_at = now();
set role anon;
do $$ begin
  if jsonb_array_length(list_meditations()) <> 1 then raise exception 'FAIL published meditation not listed'; end if;
  if list_meditations()::text like '%9725%' then raise exception 'FAIL phone in meditations list'; end if;
  if (list_meditations()->0->'tags')::text <> '["home"]' then raise exception 'FAIL tags %', list_meditations()->0->'tags'; end if;
  raise notice 'ok  published meditation is listed, without phone, with valid tags only';
end $$;
reset role;

-- 30.11: personal data goes, published meditations stay.
do $$ declare r jsonb := purge_personal_data(); begin
  if (select count(*) from circles) <> 0 or (select count(*) from circle_log) <> 0 then raise exception 'FAIL purge circles'; end if;
  if (select count(*) from submissions where owner_phone is not null) <> 0 then raise exception 'FAIL purge phones'; end if;
  if (select count(*) from submissions where status = 'published') <> 1 then raise exception 'FAIL purge removed published'; end if;
  raise notice 'ok  purge: % ', r;
end $$;

\echo ALL TESTS PASSED
