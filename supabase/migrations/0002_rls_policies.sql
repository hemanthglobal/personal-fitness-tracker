-- 0002 — Row Level Security.
--
-- Rule: a signed-in user can access only their own rows. Anonymous visitors get nothing.
-- `(select auth.uid())` is wrapped in a sub-select so Postgres evaluates it once per query.

alter table public.exercise_codes      enable row level security;
alter table public.profiles            enable row level security;
alter table public.programmes          enable row level security;
alter table public.programme_days      enable row level security;
alter table public.workout_sessions    enable row level security;
alter table public.exercise_sets       enable row level security;
alter table public.exercise_notes      enable row level security;
alter table public.body_weight_entries enable row level security;

-- Defence in depth: anon has no table privileges at all.
revoke all on
  public.exercise_codes, public.profiles, public.programmes, public.programme_days,
  public.workout_sessions, public.exercise_sets, public.exercise_notes, public.body_weight_entries
from anon;

-- Signed-in users: exercise_codes is read-only reference data.
revoke insert, update, delete, truncate on public.exercise_codes from authenticated;
grant select on public.exercise_codes to authenticated;

create policy "exercise codes are readable by signed-in users"
  on public.exercise_codes for select to authenticated
  using (true);

-- Profiles: select / insert / update own row. No delete (account deletion needs a server-side flow).
revoke delete, truncate on public.profiles from authenticated;

create policy "profiles: select own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: insert own" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- User-owned tables: full CRUD on own rows only.
create policy "programmes: own rows" on public.programmes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "programme_days: own rows" on public.programme_days for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "workout_sessions: own rows" on public.workout_sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "exercise_sets: own rows" on public.exercise_sets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "exercise_notes: own rows" on public.exercise_notes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "body_weight_entries: own rows" on public.body_weight_entries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Note: child rows can only reference a parent via (parent_id, user_id). With the policies
-- above forcing user_id = auth.uid(), the parent must belong to the same user, so the
-- frontend cannot attach data to another user's programme/day/session.
