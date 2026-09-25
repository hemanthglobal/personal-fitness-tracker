-- RLS + integrity tests (pgTAP). Run locally with:  supabase test db
-- Everything runs in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- Two test users. Profiles are created by the on_auth_user_created trigger.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'user-a@example.test'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'user-b@example.test');

select is(
  (select count(*) from public.profiles where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002')),
  2::bigint, 'profiles are created automatically on sign-up');

-- ============================== User A: own data ==============================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok($$ insert into public.programmes (id, start_date)
  values ('a1000000-0000-4000-8000-000000000001', '2026-09-25') $$, 'A can create a programme');

select lives_ok($$ insert into public.programme_days (id, programme_id, day_number, cycle_number, workout_code, workout_type, is_rest_day, scheduled_date)
  values ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 1, 1, 'A', 'light', false, '2026-09-25') $$,
  'A can create a programme day');

select lives_ok($$ insert into public.workout_sessions (id, programme_day_id)
  values ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001') $$, 'A can create a workout session');

select lives_ok($$ insert into public.exercise_sets (workout_session_id, exercise_code, set_number, weight_kg, reps, completed)
  values ('a3000000-0000-4000-8000-000000000001', 'db_lateral_raise', 1, 10, 8, true) $$, 'A can log a set');

select lives_ok($$ insert into public.body_weight_entries (recorded_at, weight, unit)
  values ('2026-09-25', 80, 'kg') $$, 'A can log body weight');

select is((select count(*) from public.programmes), 1::bigint, 'A reads own programme');
select is((select count(*) from public.exercise_sets), 1::bigint, 'A reads own sets');
select is((select count(*) from public.profiles), 1::bigint, 'A reads only own profile');

-- ============================== Integrity ==============================
select throws_ok($$ insert into public.exercise_sets (workout_session_id, exercise_code, set_number, reps)
  values ('a3000000-0000-4000-8000-000000000001', 'db_lateral_raise', 2, -1) $$, '23514', null, 'negative reps rejected');

select throws_ok($$ insert into public.exercise_sets (workout_session_id, exercise_code, set_number, reps)
  values ('a3000000-0000-4000-8000-000000000001', 'db_lateral_raise', 9999, 8) $$, '23514', null, 'set number 9999 rejected');

select throws_ok($$ insert into public.exercise_sets (workout_session_id, exercise_code, set_number, reps)
  values ('a3000000-0000-4000-8000-000000000001', 'made_up_exercise', 1, 8) $$, '23503', null, 'unknown exercise code rejected');

select throws_ok($$ insert into public.exercise_sets (workout_session_id, exercise_code, set_number, weight_kg)
  values ('a3000000-0000-4000-8000-000000000001', 'db_lateral_raise', 3, -5) $$, '23514', null, 'negative weight rejected');

select throws_ok($$ insert into public.programme_days (programme_id, day_number, cycle_number, workout_code, workout_type, is_rest_day, scheduled_date)
  values ('a1000000-0000-4000-8000-000000000001', 3, 1, 'C', 'light', false, '2026-09-27') $$, '23514', null,
  'day 3 must be a rest day (schedule pattern enforced)');

select throws_ok($$ insert into public.programmes (user_id, start_date)
  values ('bbbbbbbb-0000-4000-8000-000000000002', '2026-09-25') $$, '42501', null, 'A cannot create rows owned by B');

-- ============================== User B: A's data is invisible ==============================
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is((select count(*) from public.programmes), 0::bigint, 'B cannot read A''s programme');
select is((select count(*) from public.programme_days), 0::bigint, 'B cannot read A''s programme days');
select is((select count(*) from public.workout_sessions), 0::bigint, 'B cannot read A''s workout sessions');
select is((select count(*) from public.exercise_sets), 0::bigint, 'B cannot read A''s sets');
select is((select count(*) from public.body_weight_entries), 0::bigint, 'B cannot read A''s body weight');
select is((select count(*) from public.profiles), 1::bigint, 'B reads only own profile');

select results_eq($$ with u as (update public.exercise_sets set reps = 99 returning 1) select count(*) from u $$,
  $$ values (0::bigint) $$, 'B cannot modify A''s sets');
select results_eq($$ with d as (delete from public.programmes returning 1) select count(*) from d $$,
  $$ values (0::bigint) $$, 'B cannot delete A''s programme');
select results_eq($$ with u as (update public.profiles set weight_unit = 'lb' where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1) select count(*) from u $$,
  $$ values (0::bigint) $$, 'B cannot modify A''s profile');

select throws_ok($$ insert into public.workout_sessions (programme_day_id)
  values ('a2000000-0000-4000-8000-000000000001') $$, '23503', null, 'B cannot attach a session to A''s programme day');
select throws_ok($$ insert into public.exercise_sets (workout_session_id, exercise_code, set_number, reps)
  values ('a3000000-0000-4000-8000-000000000001', 'db_lateral_raise', 2, 8) $$, '23503', null, 'B cannot add sets to A''s session');

-- A's data is untouched.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select reps from public.exercise_sets where set_number = 1), 8, 'A''s set was not modified by B');

-- ============================== Anonymous visitor ==============================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$ select * from public.programmes $$, '42501', null, 'anon cannot read programmes');
select throws_ok($$ select * from public.exercise_sets $$, '42501', null, 'anon cannot read workout data');
select throws_ok($$ insert into public.body_weight_entries (user_id, recorded_at, weight, unit)
  values ('aaaaaaaa-0000-4000-8000-000000000001', '2026-09-26', 70, 'kg') $$, '42501', null, 'anon cannot write private data');

select * from finish();
rollback;
