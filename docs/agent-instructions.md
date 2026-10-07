# Agent instructions (summary)

Two instruction documents drive this project:

1. **Product / programme / UI-UX brief**: the 60-day tracker requirements (supplied in chat; summarised below).
2. **Architecture + deployment**: `docs/architecture-instructions.md` (Vite, TypeScript, Tailwind,
   Supabase Auth + Postgres + RLS, GitHub Actions → GitHub Pages, custom domain).

Where they conflict, keep the programme and premium UI/UX requirements from (1) and follow (2) for
infrastructure. For example, (1) asked for no login or backend, while (2) requires Supabase Auth, so
the app keeps a local-only mode for when Supabase isn't configured.

## Non-negotiables from the product brief

- The supplied PDF is the source of truth. Don't invent, add, remove or rename exercises, sets or reps.
- Calendar: a 12-day cycle `A-L, B-H, Rest, C-L, D-H, Rest, A-H, B-L, Rest, C-H, D-L, Rest`, repeated
  for 5 cycles. It's generated, not hard-coded.
- Reps: light = 7 + cycle (8–12), heavy = 3 + cycle (4–8). Pullups are to failure.
- Tempo/rest: light is 2 s up / 3 s down with 60 s rest. Heavy is explosive up / controlled down
  with 3–4 min rest. No rest inside supersets. Don't invent a heavy eccentric duration.
- Day 1 = start date. Don't skip weekends and don't shift missed days.
- A workout is complete only when the user presses **Complete workout**. Completed days stay editable.
- Rest days are first-class and never forced.
- Never fabricate history, progress, weight suggestions or nutrition targets. The PDF's meal-plan
  numbers are labelled "Source example".
- Don't invent exercise video URLs. Only the PDF's general URL (muscleandfitness.com/60days) is used
  until verified per-exercise links are added to `EXERCISE_VIDEOS` in `src/data/exercise-guide.ts`.
- (v2) Every exercise card shows a breathing cue, labelled as a general tip because it isn't from the
  PDF. The demo button appears only when a verified URL exists, opens in a new tab, and is blocked
  with a message when offline.
- Keep the physician notice small and informational.
- Mobile first, premium feel, accessible (labels, focus states, not colour-only), reduced motion
  respected, and it works offline.

## Later decisions by the user (these override the brief)

- **Programs, not a fixed calendar.** 60 Days to Fit is one built-in program. Users can build their own
  (e.g. Push / Pull / Legs + Upper / Lower) and switch programs. Past runs and every logged workout are
  kept as history.
- **The plan moves with you.** A program is a sequence of days. Skipping a day pushes the rest back.
  Nothing is "missed". This replaces the brief's "don't shift missed days" rule.
- **Rest days are ticked manually**, and can be **skipped** ("Train instead") to bring the next workout forward.
- **Swap workout** (do another workout from the program today; the planned day stays next up) and
  **free workouts** (any exercises, logged on the calendar, not counted as a program day).
- The Calendar tab is a real month calendar and training log. The cycle-by-cycle plan is on Progress.

## Verified differences between the brief and the PDF

See the "Source notes" section of the README. The PDF version was implemented.
