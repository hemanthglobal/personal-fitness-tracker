-- 0003 — Indexes for the app's actual query patterns.
-- Several lookups are already covered by UNIQUE constraints:
--   programme_days (programme_id, day_number), workout_sessions (programme_day_id),
--   exercise_sets (workout_session_id, exercise_code, set_number),
--   exercise_notes (workout_session_id, exercise_code), body_weight_entries (user_id, recorded_at).

create index programmes_user_created_idx      on public.programmes (user_id, created_at desc);
create index programme_days_user_date_idx     on public.programme_days (user_id, scheduled_date);
create index workout_sessions_user_idx        on public.workout_sessions (user_id);
create index exercise_sets_user_exercise_idx  on public.exercise_sets (user_id, exercise_code);
create index exercise_notes_user_idx          on public.exercise_notes (user_id);
