# 60 Days Tracker

A personal, mobile-first training log. It ships with the **60 Days to Fit** strength programme
(from the source PDF), lets you build your own programs (e.g. Push / Pull / Legs + Upper / Lower),
and logs every workout on a real calendar: what to do today, set-by-set logging with previous
performance, swaps, free workouts, progress, body weight, and the PDF's nutrition reference.

```
GitHub Pages (static frontend)  ──HTTPS──▶  Supabase (Auth + Postgres with Row Level Security)
Vite · TypeScript · Tailwind CSS            local cache in the browser for offline use
```

- **Built-in program** (exercises, sets, reps, supersets, tempo) lives in `src/data/workout-data.ts`,
  transcribed from the source PDF. The PPL template is in `src/data/programs.ts`.
- **User data** (your programs, program runs, dated workout sessions, sets, notes, body weight)
  lives in Supabase, scoped to the signed-in user by RLS.
- **Local-only mode:** if the Supabase env vars aren't set, the app runs entirely in the browser
  with `localStorage` and no login. Handy for development.

---

## Local development

Requires Node.js 20+.

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run test
npm run build        # outputs dist/
npm run preview      # serves dist/ locally
```

Without a `.env.local` the app starts in local-only mode. To use Supabase locally, copy
`.env.example` to `.env.local` and fill in your values (see below).

## Environment

| Variable | What | Safe in browser? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Project's **publishable** key (`sb_publishable_…`) | Yes, designed for client use |

Everything prefixed `VITE_` is bundled into the JavaScript that ships to the browser.
**Never** put the secret / `service_role` key or the database password in any `VITE_` variable,
in `src/`, in `public/`, or in the repo. `.env`, `.env.local` and `.env.*.local` are git-ignored.

---

## Supabase setup

1. **Create a project** at [supabase.com](https://supabase.com). Note the project URL and the
   publishable key (Project Settings → API Keys).
2. **Run the migrations** in `supabase/migrations/`, in order:
   - With the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started):
     ```bash
     npx supabase login
     npx supabase link --project-ref <project-ref>
     npx supabase db push
     ```
   - Or paste each file into the dashboard's SQL editor, in order (0001 → 0004). Prefer the CLI so the
     repo stays the source of truth.
3. **Auth** (Authentication → Sign In / Providers): keep **Email** enabled with
   "Confirm email" on. No other providers are used.
4. **URL configuration** (Authentication → URL Configuration):
   - **Site URL:** your production URL, e.g. `https://your-domain.com`
   - **Redirect URLs:** exactly your production URL and `http://localhost:5173`. Don't use `*`.
5. **Check RLS:** Table Editor should show RLS **enabled** on every table. Policies are in
   `0002_rls_policies.sql`.
6. **Run the security tests** (needs Docker for the local stack):
   ```bash
   npx supabase start
   npx supabase test db     # runs supabase/tests/rls.test.sql (pgTAP)
   ```
   These check that user A can read and write only their own data, that user B can't read or
   modify A's programs, runs, sessions, sets or body weight, and that anonymous visitors are denied.
   They also check that invalid data is rejected: negative reps or weight, out-of-range set numbers,
   malformed exercise codes, and program sessions without a day.

### Schema overview

| Table | Purpose |
| --- | --- |
| `profiles` | 1:1 with `auth.users` (auto-created on sign-up). Weight unit preference. |
| `custom_programs` | Programs you build (workouts, day pattern, length) as validated JSON. |
| `programmes` | Program **runs**: which program (`program_ref`), start date, status. At most one `active`. |
| `run_days` | Days of a run that are done or skipped, and the date it happened. |
| `training_sessions` | What you trained on a date: a program day, a swapped workout, or a free workout. Ids are made on the device so offline logging syncs later. |
| `session_sets` | Sets: `exercise_code`, `set_number` (1–10), `weight_kg`, `reps`, `completed`. |
| `session_notes` | Per-exercise notes within a session. |
| `body_weight_entries` | One entry per user per date. |
| `programme_days`, `workout_sessions`, `exercise_sets`, `exercise_notes`, `exercise_codes` | Original 60-day tables from 0001. Migration 0004 copies their data into the new tables; the app no longer uses them. |

Every user table has `user_id`. Child tables reference their parent with a composite foreign key
`(parent_id, user_id)`. Together with RLS (`user_id = auth.uid()`), this means no request can attach
data to another user's programme, day or session, even with a guessed UUID.

---

## GitHub + GitHub Pages

1. Create a repository (e.g. `personal-fitness-tracker`) and push this folder to `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → Variables** (not Secrets, since these values are
   public by design): add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Every push to `main` runs `.github/workflows/deploy.yml`: `npm ci` → typecheck → tests → build →
   deploy `dist/` to Pages. Any failure stops the deploy. Pull requests run the checks without deploying.

The build uses a relative base path (`./`) and hash routes (`#/today`, `#/day/17`), so the same
build works at `https://<user>.github.io/<repo>/` and at a custom domain root, with no server-side
routing needed.

## Custom domain

1. **GitHub:** Settings → Pages → Custom domain → enter `your-domain.com` (or `www.your-domain.com`).
   Also verify the domain under your account/org **Settings → Pages → Verified domains**, which
   protects against domain takeover.
2. **DNS provider:** add the records GitHub's docs list for your case. For an apex domain that's
   A/AAAA records or ALIAS/ANAME; for `www` it's a CNAME to `<user>.github.io`. Copy the current
   values from
   [GitHub's custom domain docs](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site);
   don't guess them. Don't use wildcard DNS records.
3. **HTTPS:** once the certificate is issued, tick **Enforce HTTPS**.
4. **Supabase:** set the Site URL and Redirect URL to the final `https://your-domain.com`.

---

## Using the app

- **Programs** (More → Programs): run one program at a time. Start **60 Days to Fit**, use the
  **Push / Pull / Legs + Upper / Lower** template, or build your own: name it, add workouts with
  exercises (sets × target reps, blank reps = to failure), set the repeating day pattern (e.g. Push,
  Pull, Legs, Rest, Upper, Lower, Rest) and how many times it repeats, or "until I stop". Switching
  program ends the current one; it stays in **History** with everything you logged.
- **The plan moves with you.** A program is a sequence of days, not fixed dates. Today always shows
  your **next** day. Take a day off and the rest of the plan slides back (Today and the Calendar show
  the new finish date). Nothing is ever marked "missed".
- **Today:** your next workout with one **Start workout** button, plus:
  - **Swap workout:** do a different workout from your program today. It counts as that workout's
    next open day, and your planned day stays next up.
  - **Log a free workout:** any exercises you like, logged on the calendar but not counted as a
    program day.
  - On a **rest day**: *Mark rest day complete*, or **Train instead**, which skips the rest day and
    brings up your next workout. Rest days only count when you tick them.
- **Workout:** tempo and rest rules on 60 Days to Fit days, and supersets grouped visually. Each set
  has a weight and a reps field with −/+ steppers and a ✓. Ticking an empty set logs the suggested
  values: your last weight, and the target reps. A rest timer counts up after each set (inside a
  superset it says "go straight to the next exercise" instead). **Add set** and **Add an exercise**
  work on any workout. **Trained on** lets you back-date a workout you forgot to log. Everything
  saves as you type. Press **Complete workout** to finish. You can reopen, edit or delete any logged
  workout.
- **Exercise guidance:** each exercise card shows a short breathing cue (in / out). These cues are
  **general tips, not part of the programme PDF**, and are labelled that way. When you add a demo
  video for an exercise, a **Watch exercise demo ↗** button appears. It opens in a new tab, so your
  logged sets stay put, and it's blocked with a message when you're offline.
- **Warm-up & stretching:** guided warm-ups and cool-down stretches on every workout (matched to
  60 Days to Fit workouts A–D, and full-body for your own programs), plus a full-body stretch on
  rest days. They use timed moves, get-ready gaps, beeps and auto-advance. These are **general
  guidance, not from the PDF**. Edit them in `src/data/routines.ts`.
- **Screen stays on** while a warm-up, stretch or rest timer runs (Screen Wake Lock: current
  Chrome, Edge and Safari). Timer sounds can be switched off in Settings.
- **Calendar:** a real month calendar and your training log. Past dates show what you actually did,
  from any program, swaps and free workouts. Today and upcoming dates show your active program's
  plan (dashed), if you train every planned day. Tap a date for details, or to log a workout on a
  past date.
- **Progress:** your active program (days done, workouts, rest days, finish date) with its plan by
  cycle or week. Also your training days over the last 4 weeks, personal bests across all programs,
  and body weight.
- **More:** programs, body weight log, warm-ups and stretches, the 60 Days to Fit guide, nutrition
  reference (the source's *example* values, not personal targets), shopping list and supplements.

### Adding exercise demo videos

Open `src/data/exercise-guide.ts` and add entries to `EXERCISE_VIDEOS`, keyed by exercise code
(the codes are in `src/data/workout-data.ts`):

```ts
export const EXERCISE_VIDEOS: Record<string, string | null> = {
  db_lateral_raise: "https://…",
  squat: "https://…",
};
```

Only `https://` links are used. An exercise with no entry just doesn't show a demo button, so there
are never dead buttons. Check that each link really shows the named exercise before adding it.
Breathing cues live in the same file (`BREATHING`). A test makes sure every exercise has one.

### Where data is stored, and sync

- **Cloud mode:** your Supabase account is the source of truth. Every change is written to a
  per-user cache in `localStorage` first, so the UI is instant and works offline. It is then queued
  and uploaded. The small status chip shows *Saving…*, *Synced*, *Offline*, or *Couldn't sync ·
  Retry*. Unsynced changes survive refreshes and are uploaded when you're back online.
- **Conflicts:** last write wins. If you edit the same workout on two devices while offline, whichever
  syncs last replaces that workout's log. There is no field-level merging.
- Everything works offline, including starting a program and logging free workouts. Only **Clear
  all data** needs a connection.
- **Log out** clears this user's cached data from the device.

### Export / import

Settings → **Export my data** downloads `fitness-tracker-backup-YYYY-MM-DD.json`. **Import data**
validates the file, asks for confirmation, and replaces your programs, runs, workout logs and
body-weight log. Older backups (from before programs existed) are converted automatically.
This is a convenience copy, not a database backup. For backups, use Supabase's own backup and export
features. Never commit export files; they're git-ignored.

### Reset

Settings → **Restart current program** (with confirmation) starts your active program again from
Day 1 today. The old run stays in your history. **End program** (Programs) stops it without
starting another. **Clear all data** deletes all programs, logs and body weight. Deleting the Auth account itself would need a server-side function. That isn't
implemented, because an admin key must never reach the browser.

---

## Project structure

```
src/
  main.ts               boot: local mode or Supabase Auth → load → render
  app.ts                hash router, event delegation, actions, forms
  data/workout-data.ts  programme definition (source of truth: the PDF)
  lib/                  state, local cache, sync outbox, Supabase client/auth/data access, utils
  components/           icons, toast, modal, nav, day card, exercise card, set row, shared UI
  views/                today, calendar, workout/rest, progress, weight, nutrition, more, settings, auth
  styles/main.css       Tailwind + design tokens + component styles (light/dark)
public/                 sw.js (offline), manifest, icons
supabase/migrations/    0001 schema · 0002 RLS · 0003 indexes
supabase/tests/         pgTAP RLS + integrity tests
tests/                  Vitest: calendar, rep progression, data integrity, date logic, backup validation
```

## Source notes

The programme data was checked against the PDF's calendar (p.3) and exercise tables (pp.4–5).
The build brief listed a few details differently from the PDF. The **PDF version is used**:

- **A Light** has 7 exercises. Cable Shrug is a superset with Dumbbell Upright Row, and Scott Press
  stands alone.
- **B Light** uses "Standing Single-arm **Cable** Row" and "Straight-arm **Pushdown**".
  Straight-bar Curl and Dumbbell Spider Curl are separate exercises, not a superset.
- **C Light** pairs Rope Pushdown with Dumbbell Overhead Extension. Incline French Press and
  Dumbbell Kickback stand alone.

Brand names in the meal plan and shopping list were replaced with generic descriptions (whey
protein, sports drink, salt-free seasoning). The source's physician-consultation notice is shown in
the Nutrition, Supplements and Programme guide screens.
