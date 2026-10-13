# Project handoff: 60 Days Tracker (personal fitness training log)

Everything built so far, every decision made, and how to keep developing. Written so a new session
(or a new developer) can continue without the original conversation.

Last updated: 2026-10-07 · Last commit: `6f932bd` "Programs, flexible plan and calendar training log"

---

## 1. Quick facts

| | |
| --- | --- |
| Owner | GitHub `hemanthglobal` (email hemanthreddy16699@gmail.com) |
| Repo | https://github.com/hemanthglobal/personal-fitness-tracker (branch `main`) |
| Live site | https://hemanthglobal.github.io/personal-fitness-tracker/ |
| Local folder | `C:\Users\heman\Downloads\60 Days Gym Website\fitness-tracker` (the git repo root) |
| Parent folder | `C:\Users\heman\Downloads\60 Days Gym Website` (holds `.claude/launch.json` for the preview server) |
| Source PDF | `C:\Users\heman\Downloads\60-Day-Fitness-Plan-Template-PDF-Free-Download.pdf` (7 pages, the source of truth for the built-in program) |
| Original briefs | Product/UI brief v1 (pasted in chat) and v2 `C:\Users\heman\Downloads\fitness_tracker_agent_instructions_v2.md`; architecture brief `C:\Users\heman\Downloads\github_supabase_architecture_instructions.md` (copied to `docs/architecture-instructions.md`) |
| Stack | Vite 8 · TypeScript (strict) · Tailwind CSS v4 · vanilla TS (no framework) · Supabase (Auth + Postgres + RLS) · GitHub Actions → GitHub Pages |
| Status | Live and deployed. Migrations 0001–0004 have been run on the user's Supabase project. |

---

## 2. What the app is (current behaviour)

A mobile-first personal **training log** with **programs**:

- **Programs** (More → Programs, `#/programs`)
  - Built-in **60 Days to Fit** (from the PDF): 60 days, 5 cycles × 12 days, A–D workouts with light/heavy variants, reps from the cycle (light = 7 + cycle, heavy = 3 + cycle), pullups to failure.
  - **Template**: Push / Pull / Legs + Upper / Lower (Push, Pull, Legs, Rest, Upper, Lower, Rest), 8 weeks. Exercises and reps are general (not from the PDF) and labelled that way.
  - **Builder** (`#/program/new`, `#/program/new/template`, `#/program/edit/<id>`): name, workouts (exercises with sets and target reps; blank reps = to failure), repeating day pattern (workout or rest per day; reorder/remove), and length (repeat N times, or until stopped).
  - **One active run at a time.** Starting another ends the current run (status `ended`), which stays in History with all its logs. A run whose last day is done becomes `finished`.
- **Flexible plan ("the plan moves with you")**: a program is a sequence of days, not fixed dates. Today shows the **next** undone day. A day off pushes the rest back, and the projected finish date moves (shown on Today, Calendar, Progress). Nothing is ever "missed".
- **Rest days** are ticked manually ("Mark rest day complete") or skipped ("Train instead"), which marks the rest as `skipped` and brings the next workout up today.
- **Swap workout** (`#/swap`): do another workout from the program today. It counts as that workout's next open day, and the planned day stays next up.
- **Free workout**: any exercises (typed or picked from a datalist; custom names get a `custom_<slug>` code). Logged on the calendar, not counted as a program day.
- **Workout screen** (`#/day/<n>` for the active run, `#/log/<sessionId>` for any logged session):
  - Set rows with weight/reps steppers and a tick. Ticking an empty set logs the placeholders (last weight, target reps). The weight carries forward to later sets.
  - Superset grouping; rest timer (count-up; shows the PDF target and beeps on 60 Days days); "Next: …" hint inside supersets.
  - **Add set**, **Add an exercise**, **Remove** (free workouts), **Trained on** date (back-dating), notes, **Complete workout**, **Mark not done**, **Delete this workout log**.
  - Breathing cue on each card (general tip, not from the PDF). Optional demo-video button only when a URL exists in `EXERCISE_VIDEOS` (currently empty; the user will add links later). The PDF's general video trainer link is shown on 60 Days workouts.
  - Warm-up card above the exercises and cool-down stretch below (A–D-specific for 60 Days, full-body for custom/free workouts).
- **Warm-up & stretching timers** (`#/routines`, `#/session/<warmup|stretch>/<A|B|C|D|full>/<day | log:<sessionId>>`): overview first, then Start. 5 s get-ready, beeps in the last 3 s, auto-advance, pause/back/skip, per-side moves expanded to Left/Right. **Screen Wake Lock** is held while it runs (and during the workout rest timer). If the browser refuses the lock, the screen says so honestly.
- **Calendar** (`#/calendar`): a real month calendar (Monday first) and the training log. Past dates show actual sessions from any program, plus free workouts and rest done/skipped. Today and future dates show the active run's projection (dashed). Tapping a date opens a detail card with links and "Log a free workout on this day" for past dates.
- **Progress** (`#/progress`): active run stats (days done, workouts, rest days, finish/slip), the **plan by cycle (60 Days) or week (custom)** with day tiles, the last 4 weeks of training days, personal bests across all programs, and body weight.
- **More**: Programs, Body weight (log, chart), Warm-up & stretching, 60 Days to Fit guide (`#/about`), Nutrition reference (PDF example values, labelled "Source example"), Shopping list (local-only checklist), Supplements, Settings.
- **Settings**: weight unit kg/lb (weights stored in kg), theme system/light/dark, timer sounds on/off, Programs link, Export/Import JSON, Restart current program, Clear all data, Log out (cloud mode).
- **Onboarding**: choose 60 Days / PPL template / "Not yet" (free workouts only), a start date, and a unit.
- **Auth** (cloud mode): email + password sign up, log in, forgot/reset password (PKCE flow), session persisted. Friendly error messages only.
- **Offline**: service worker (`public/sw.js`) caches the app shell; the local cache plus the outbox make logging work offline.

---

## 3. Decision history (why things are the way they are)

1. **PDF over brief.** The brief's exercise lists differed from the PDF. The PDF was followed:
   - A Light has 7 exercises: Cable Shrug is a superset with Dumbbell Upright Row, and Scott Press stands alone.
   - B Light uses "Standing Single-arm **Cable** Row" and "Straight-arm **Pushdown**", and Straight-bar Curl and Spider Curl are separate.
   - C Light pairs Rope Pushdown with DB Overhead Extension, and French Press and Kickback stand alone.
   - Brand names in the meal and shopping lists were genericised.
2. **Architecture brief overrides "no backend".** Supabase Auth + Postgres + RLS. A local-only mode is kept when the env vars are absent (handy for dev and testing).
3. **v2 brief:** breathing cues on every exercise (labelled as a general tip), and an optional verified video button (no invented URLs).
4. **User asked for warm-up/stretch timers that keep the screen on** → routines + Wake Lock (rest timer included).
5. **User asked for a real month calendar** → the Calendar tab became a month view, and the cycle tiles moved to Progress.
6. **User said they'll skip days** → the plan moves with you (replaces the brief's "don't shift missed days" rule). Rest days are ticked manually (user's choice).
7. **User wants to skip rest days, change the day's workout, and run other programs later (PPL…)** → full programs model. The user's answers:
   - **Both** a builder and the PPL template.
   - **Both** swap options: another workout from the program, and free workouts.
   - Skipping a rest day **marks it skipped and brings the next workout up** (doesn't add a day).

These are recorded in `docs/agent-instructions.md` ("Later decisions by the user").

---

## 4. Code map (`fitness-tracker/`)

```
index.html                 shell: nav (Today/Calendar/Progress/More), #view, toasts, #session-live, dialog
src/main.ts                boot: local mode, or Supabase auth → initUser → pull → render; SW registration (prod only)
src/app.ts                 hash router (ROUTES), render(), event delegation (Actions map), change/input/submit handlers
src/styles/main.css        Tailwind import + design tokens (light/dark) + all component CSS (@layer components)

src/data/
  workout-data.ts          60 Days to Fit from the PDF (WORKOUTS, CYCLE_PATTERN, INTENSITY, getSchedule, getTargetReps,
                           NUTRITION, SHOPPING, SUPPLEMENTS, REST_ACTIVITIES, VIDEO_URL). Exercise codes must match migration 0001 seed.
  programs.ts              Program model: BUILTIN_60 ("builtin:60days"), CustomProgram, Slot, slotFor(), programLength(),
                           workoutChoices(), pplTemplate(), builtinExercises(), codeForName(), shortFor()
  exercise-guide.ts        BREATHING cues per code; EXERCISE_VIDEOS (empty, the user adds https links later); videoFor()
  routines.ts              WARMUPS (A–D + full) and STRETCHES (A–D + full), expandSteps(), PREP_SECONDS=5

src/lib/
  state.ts                 AppState v3 + normalizeState (validates; migrates v1/v2 → v3), store, changed(key), runs/sessions helpers,
                           projection(run) cache, currentDay(), dayStatus(), startRun/endRun/setRestDay, createSession/completeSession/
                           setSessionDate/deleteSession, findPrevious, personalBests, knownExercises, units (kg storage)
  schedule.ts              PURE projectRun(run, length, today) → {dates, next, finish, plannedFinish, slip}; atDate()
  sync.ts                  local cache + outbox (keys run:/session:/program:/bw:/profile), flush with ordering + backoff,
                           pull() merge (queued local objects win), clearAllData, replaceWithImport
  database.ts              Supabase mapping: fetchSnapshot, pushProgram/pushRun/pushSession/pushBodyWeight/pushProfile, deleteAllUserData
  storage.ts               localStorage helpers; cacheKey(userId) namespaces ("fitnessTracker" local, "fitnessTracker:<uid>" cloud)
  supabase.ts              client (PKCE, persisted session); cloudEnabled if both env vars are set; strips a pasted /rest/v1/
  auth.ts                  signIn/signUp/sendPasswordReset/updatePassword/signOut, friendlyAuthError
  wake-lock.ts             reference-counted Screen Wake Lock, re-acquired on visibility, wakeLockBlocked()
  sound.ts                 WebAudio beeps + vibration (unlockAudio on a tap)
  utils.ts                 $, $$, esc, dates (toISO, parseISO, addDays, daysBetween, getTodayProgramDay, fmtDate…)

src/components/            icons, toast, modal (confirmDialog resolves on form submit), navigation (sync chip),
                           ui (pill, pageHeader, emptyState, progressBar, guidance, listLink, healthNotice),
                           day-card (relDate, restHero, upcomingList, dayTile, finishLine), exercise-card, set-row
src/views/                 today, calendar (month log), workout (day/log/swap + all set interactions), progress, plan (Progress plan section),
                           programs (list/start/builder), session (timers), more (more/about/shopping/supplements), nutrition,
                           weight, settings, onboarding, auth
public/                    sw.js (cache-first shell, network-first navigation), manifest.webmanifest, icons (svg + 192/512 png)
supabase/migrations/       0001 schema · 0002 RLS · 0003 indexes · 0004 programs & sessions (ALL APPLIED on the live project)
supabase/tests/rls.test.sql  pgTAP: 43 checks (RLS cross-user/anon + integrity). NOT YET RUN (needs Docker + Supabase CLI)
tests/                     Vitest (71 tests): programme.test (PDF calendar/reps/data), programs.test, schedule.test, state.test (v3 + v2 migration),
                           routines.test, exercise-guide.test
.github/workflows/deploy.yml  push to main: npm ci → typecheck → test → build (VITE_* from repo Variables) → deploy Pages
docs/                      agent-instructions.md (rules + user decisions), architecture-instructions.md, HANDOFF.md (this file)
```

### Routes

`#/today` · `#/calendar` · `#/progress` · `#/more` · `#/day/<n>` · `#/log/<sessionId>` · `#/swap` · `#/programs` ·
`#/program/start/<ref>` · `#/program/new[/template]` · `#/program/edit/<id>` · `#/routines` · `#/session/<kind>/<key>/<back>` ·
`#/weight` · `#/nutrition` · `#/shopping` · `#/supplements` · `#/about` · `#/settings` · auth: `#/login` `#/signup` `#/forgot`

---

## 5. Data model

### Client state (v3, `src/lib/state.ts`)

```ts
AppState {
  version: 3; onboarded: boolean;
  settings: { weightUnit: "kg"|"lb"; theme: "system"|"light"|"dark"; sound: boolean };   // theme/sound are local-only
  programs: Record<id, CustomProgram>;        // { id, name, workouts[{key,name,short,exercises[{code,name,sets,reps|null,superset?}]}], pattern[(key|null)], repeats|null }
  runs: Record<id, Run>;                      // { id, programRef ("builtin:60days" | "custom:<uuid>"), name, startDate, status active|finished|ended, endedAt, days{n: {status done|skipped, date, sessionId}}, createdAt }
  activeRunId: string | null;
  sessions: Record<id, Session>;              // { id, date, runId|null, day|null, workoutKey|null, title, plan[ProgramExercise snapshot], logs{code: {sets[{weight kg|null, reps|null, done}], notes}}, status in_progress|done, completedAt, createdAt, updatedAt }
  bodyWeight: { date, weight (kg), notes }[];
  shopping: Record<itemKey, true>;            // local-only
}
```

- Ids are made on the device (`crypto.randomUUID`), so everything works offline and syncs later.
- 60 Days workout keys are `"A-light"`, `"B-heavy"`, and so on. Short labels are `AL`, `BH`, …
- Sessions snapshot the exercise plan, so editing a program never rewrites history. Old migrated sessions have an empty plan and fall back to the program definition (`sessionPlan()`).

### Database (Supabase, project already migrated)

- Live tables: `profiles`, `custom_programs` (definition jsonb), `programmes` (= runs; `program_ref`, `ended_at`, status active/completed/cancelled ↔ active/finished/ended; partial unique index: one active per user), `run_days`, `training_sessions` (client ids; `(programme_id IS NULL) = (day_number IS NULL)`), `session_sets` (code regex `^[a-z0-9_]{2,64}$`, set 1–10), `session_notes`, `body_weight_entries`.
- Legacy (unused, data copied by 0004): `programme_days`, `workout_sessions`, `exercise_sets`, `exercise_notes`, `exercise_codes`.
- Security model: every user table has `user_id`. Child tables use composite FKs `(parent_id, user_id)`. RLS everywhere is `user_id = (select auth.uid())`. `anon` is revoked entirely. Verified on the live project: anonymous requests to all the new tables get `42501`. **Never** follow a Supabase hint suggesting `GRANT … TO anon`.
- Any new schema change goes in `supabase/migrations/0005_*.sql`. The user runs it in the SQL Editor **before** the app code that needs it is pushed (otherwise the live site breaks).

### Sync rules (`src/lib/sync.ts`)

- `changed(key)` → write the cache → enqueue → flush. Push order: programs → run deletes → run upserts (stable) → sessions → the rest (respects FKs and the one-active-run index).
- Permanent DB errors (codes 22xxx/23xxx/42501) drop the item with a toast. Transient errors retry with backoff. Last write wins.
- `pull()` = server snapshot + queued local objects overlaid. `activeRunId` = the newest active run.

---

## 6. Environment & tooling notes (Windows machine)

- Node 24 LTS was installed via winget at `C:\Program Files\nodejs`. In Git Bash, prefix commands with
  `export PATH="/c/Program Files/nodejs:$PATH"`.
- Commands (run in `fitness-tracker/`): `npm run dev` · `npm run typecheck` · `npm test` · `npm run build` · `npm run preview`.
- Preview server config: parent folder `.claude/launch.json` runs `C:/Program Files/nodejs/node.exe fitness-tracker/node_modules/vite/bin/vite.js fitness-tracker` on port 5173 (npm.cmd fails because `node` isn't on the app's PATH).
- `.env.local` (git-ignored) holds the user's real `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never print or commit it. Mask it if you need to inspect it.
  - **To browser-test without logging into the user's account:** `mv .env.local .env.local.bak-testing`, restart the preview (local mode), test, **then move it back and restart**. Clear test data afterwards with Settings → Clear all data (the confirm dialog's "confirm" button).
- GitHub repo **Variables** (not secrets): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Pages source is GitHub Actions.
- Supabase Auth: the Site URL and Redirect URLs should include the live URL and `http://localhost:5173`.
- Git: the repo-local identity is `hemanthglobal` / hemanthreddy16699@gmail.com. Commits end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Before every commit, scan staged files for the key and project ref (it has always been clean).
- Deploy check: the GitHub API `actions/runs?per_page=1` for status, then grep the live `assets/index-*.js` for new strings.
- Tooling quirks seen in this session:
  - Bash heredocs containing many quotes/apostrophes sometimes fail ("unexpected EOF"). Write a script into the scratchpad and run it instead.
  - Files edited via Bash/Python must be Read again before the Write tool will overwrite them.
  - Browser-pane screenshots sometimes come out zoomed or blank after viewport emulation. Re-apply `resize_window` mobile, or verify with JS/DOM instead.
  - The preview browser refuses the real Wake Lock (an embedded browser restriction). It was tested with a stubbed `navigator.wakeLock`.

---

## 7. Testing status

- Vitest: **71 passing** (PDF schedule and reps, data integrity incl. TS ↔ SQL exercise-code seed, schedule projection incl. skip/swap/rest-skip/open-ended, v2 → v3 migration, routines, guidance).
- Browser-tested (local mode): onboarding, Today states, back-dating, rest skip, swap, free workout with custom exercises, calendar log + projection, programs list/builder/template/start, run switching and history, progress plan for weekly programs, every route renders, 320px/375px/desktop, dark mode (earlier).
- **Not yet verified:**
  - Real cloud sync of the new model against the live DB (needs the user logged in on their device).
  - The pgTAP suite (needs Docker: `npx supabase start && npx supabase test db`).
  - Wake Lock on a real phone.

---

## 8. Known limitations / ideas for next steps

- **Verify on the user's phone:** log in, check migrated data on the calendar, start a program, log a workout, reload, and confirm it synced (status chip "Synced"; data visible on another device).
- Exercise demo videos: the user will supply links → add to `EXERCISE_VIDEOS` in `src/data/exercise-guide.ts` (https only, verified to show the named exercise).
- Possible improvements (not requested yet):
  - Per-workout rest timer targets for custom programs.
  - Supersets in the builder.
  - Reorder exercises.
  - Rename a free workout.
  - Body-part tags.
  - Progress charts per exercise.
  - Account deletion (needs a server-side Edge Function; never ship an admin key to the browser).
  - Drop the legacy tables in a future migration.
  - Bump GitHub Actions versions (Node 20 deprecation warning).
- Custom program edits change the mapping for future days of a running program (pattern length changes shift days). Logged sessions are unaffected.
- Deleting a custom program is blocked while it's the active run.
- The "Trained on" date can't be set in the future (max today).

---

## 9. Rules to keep following

- The PDF is the source of truth for 60 Days to Fit. Don't invent exercises, reps or video URLs.
- Label anything not from the PDF (breathing cues, warm-ups/stretches, PPL template) as general guidance.
- Never fabricate history/progress, weight suggestions, or nutrition targets.
- Keep it lightweight (no frameworks), mobile-first, accessible, premium UI; respect reduced motion.
- Commit/push only when the user asks. For schema changes, give the user the SQL to run first.
- At the end of a task, give the user short, simple, step-by-step next actions (the user asked for this style).

---

## 10. Reminders, skipped days & habits (added 2026-10-13)

- **Push reminders** via Supabase: `supabase/functions/send-reminders/index.ts` (Deno, `npm:web-push`), run every
  5 min by pg_cron (`supabase/cron_setup.sql.example`, values kept in Vault). Sends the 6 pm quote, a gym reminder
  N min before gym time (skipped on rest days or once trained), a 10 pm "nothing logged" check, and a Sunday 9 pm
  weekly summary. Dedupe uses `notification_log` (unique user/kind/local_date), claimed before sending.
  Test mode: POST `{test:true}` with the user's JWT.
- Client: `src/lib/push.ts` (subscribe, save to `push_subscriptions`, test, unsubscribe on log out),
  `src/lib/install.ts` (install prompt / iOS guide), `src/views/reminders.ts` (`#/reminders`, `#/install`),
  service worker push + notificationclick handlers (`public/sw.js`, cache `ft-v2`, no caching on localhost).
- Settings sync key `notify` → `notification_settings` (also carries `next_label` / `next_is_rest` from `nextLabel()`;
  re-sent whenever a run changes). Weekly goal is in `profiles.weekly_goal` (sync key `profile`).
- **Skipped days**: `state.marks[date] = "skipped" | "rest"` (sync key `mark:<date>` → `calendar_marks`).
  Today asks about past days with nothing logged (last 7 days, from tracking start), and about today after the
  skip-check time: *Yes, skipped* / *Rest day* (ticks the program's rest day if that's next) / *I trained · log it*
  (back-dates the program's next workout, or a free workout). The calendar shows marks with Undo.
- **Habits**: `src/lib/habits.ts` (pure: weekDates, streak, unloggedDays) + `src/components/habits.ts`
  (skip prompt, weekly goal dots + streak, quote of the day, install card). Quotes in `src/data/quotes.ts` must
  equal the function's list (tested).
- Migration **0005** (`notification_settings`, `push_subscriptions`, `notification_log`, `calendar_marks`,
  `profiles.weekly_goal`). It must be run before pushing app code that reads these tables.
- Keys: `npm run push:keys` → `.env.push.local` (git-ignored; contains the VAPID private key and CRON_SECRET; never print it).
  `VITE_VAPID_PUBLIC_KEY` goes in `.env.local` and the GitHub Variables.
- User setup steps: `docs/REMINDERS_SETUP.md`. 79 tests.
