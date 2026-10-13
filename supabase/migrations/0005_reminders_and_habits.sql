-- 0005 — Reminders (web push), skipped-day marks and weekly goal.
--
--   notification_settings — one row per user: reminder times, timezone, what to send, next workout label
--   push_subscriptions    — one row per device that enabled notifications (Web Push endpoint + keys)
--   notification_log      — what was sent, one per kind per local day (stops duplicates). Written only by
--                           the send-reminders Edge Function (service role); users can read their own.
--   calendar_marks        — a day marked "skipped" or "rest" when nothing else was logged
--   profiles.weekly_goal  — workouts per week target (1–7)

alter table public.profiles
  add column weekly_goal integer not null default 4 check (weekly_goal between 1 and 7);

-- ---------------------------------------------------------------------------
create table public.notification_settings (
  user_id                uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  enabled                boolean not null default false,
  timezone               text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  quote_enabled          boolean not null default true,
  quote_time             time not null default '18:00',
  gym_enabled            boolean not null default true,
  gym_time               time not null default '20:00',
  remind_before_min      integer not null default 30 check (remind_before_min between 0 and 180),
  skip_check_enabled     boolean not null default true,
  skip_check_time        time not null default '22:00',
  weekly_summary_enabled boolean not null default true,
  -- Written by the app so reminders can name the next workout without running program logic on the server.
  next_label             text check (char_length(next_label) <= 120),
  next_is_rest           boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger notification_settings_updated_at before update on public.notification_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint        text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh          text not null check (char_length(p256dh) <= 200),
  auth            text not null check (char_length(auth) <= 100),
  user_agent      text check (char_length(user_agent) <= 300),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

-- ---------------------------------------------------------------------------
create table public.notification_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('quote', 'gym', 'skip_check', 'weekly', 'test')),
  local_date date not null,
  sent_at    timestamptz not null default now(),
  unique (user_id, kind, local_date)
);

-- ---------------------------------------------------------------------------
create table public.calendar_marks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  mark_date  date not null,
  status     text not null check (status in ('skipped', 'rest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mark_date)
);

create trigger calendar_marks_updated_at before update on public.calendar_marks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: own rows only; anon gets nothing.
-- ---------------------------------------------------------------------------
alter table public.notification_settings enable row level security;
alter table public.push_subscriptions    enable row level security;
alter table public.notification_log      enable row level security;
alter table public.calendar_marks        enable row level security;

revoke all on public.notification_settings, public.push_subscriptions, public.notification_log, public.calendar_marks from anon;
-- The log is written only by the Edge Function (service role, server-side). Users may read their own.
revoke insert, update, delete, truncate on public.notification_log from authenticated;

create policy "notification_settings: own row" on public.notification_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "push_subscriptions: own rows" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notification_log: read own" on public.notification_log for select to authenticated
  using (user_id = (select auth.uid()));
create policy "calendar_marks: own rows" on public.calendar_marks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index notification_settings_enabled_idx on public.notification_settings (enabled) where enabled;
