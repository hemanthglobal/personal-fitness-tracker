/*
 * Workout screens:
 *   #/day/<n>   — day n of the active program (workout or rest)
 *   #/log/<id>  — a logged session (free workout, or a past program session)
 *   #/swap      — choose a different workout for today, or a free workout
 * A session is created the first time something is logged, dated today (editable).
 */
import { routineMinutes, STRETCHES, WARMUPS, type Routine } from "../data/routines";
import { builtinExercises, codeForName, workoutChoices, type ProgramExercise, type Slot } from "../data/programs";
import { INTENSITY, VIDEO_URL } from "../data/workout-data";
import type { Intensity } from "../types/workout";
import { relDate, restHero } from "../components/day-card";
import { exerciseCard, exerciseStatus } from "../components/exercise-card";
import { ICON } from "../components/icons";
import { toast } from "../components/toast";
import { emptyState, guidance, pageHeader, pill } from "../components/ui";
import { cue, unlockAudio } from "../lib/sound";
import {
  activeRun, createSession, dayStatus, displayToKg, fmtW, getOrCreateLog, knownExercises, maxWeight,
  planDate, projection, runLength, runProgramName, runSlot, sessionForDay, sessionPlan, sessionProgress, setSessionDate, store, touch, unit,
  weightStep, type Run, type Session,
} from "../lib/state";
import { $, $$, esc, fmtDate, plural, round2, todayISO } from "../lib/utils";
import { holdScreenOn } from "../lib/wake-lock";

const noProgram = () => `${pageHeader("No active program", { back: "#/today", backLabel: "Today" })}
  ${emptyState("You're not running a program right now.", "Start one, or log a free workout.", '<a class="btn btn--primary" href="#/programs">Choose a program</a>')}`;

/* ---------------------------------------------------------------------------
 * Routes
 * ------------------------------------------------------------------------- */

export function renderDay(param?: string): string {
  const run = activeRun();
  if (!run) return noProgram();
  const day = Number(param);
  const slot = runSlot(run, day);
  if (!slot) {
    return `${pageHeader("Day not found", { back: "#/calendar", backLabel: "Calendar" })}
      ${emptyState("That day isn't part of this program.", "Pick a day from the calendar.", '<a class="btn btn--primary" href="#/calendar">Open calendar</a>')}`;
  }
  const st = dayStatus(run, day);
  const when = run.days[day] ? `${run.days[day]!.status === "done" ? "Done" : "Skipped"} ${relDate(run.days[day]!.date).toLowerCase()}` : st === "current" ? "Up next" : `Planned ${relDate(planDate(run, day)).toLowerCase()}`;
  const eyebrow = `Day ${day}${slot.type === "workout" && slot.cycle ? ` · Cycle ${slot.cycle}` : ""} · ${esc(when)}`;

  if (slot.type === "rest") {
    return `${pageHeader("Rest day", { back: "#/today", backLabel: "Today", eyebrow })}
      ${restHero(run, day, "Recovery")}
      <p class="fineprint">Rest days don't need logging. Tick it when you've rested, or tap “Train instead” to skip it and do your next workout.</p>`;
  }
  return workoutView({ run, day, slot, session: sessionForDay(run, day) });
}

export function renderLog(id?: string): string {
  const s = id ? store.state.sessions[id] : undefined;
  if (!s) {
    return `${pageHeader("Workout not found", { back: "#/calendar", backLabel: "Calendar" })}
      ${emptyState("This workout log doesn't exist.", "It may have been deleted.", '<a class="btn btn--primary" href="#/calendar">Open calendar</a>')}`;
  }
  const run = s.runId ? store.state.runs[s.runId] ?? null : null;
  const slot = run && s.day ? runSlot(run, s.day) : null;
  return workoutView({ run, day: s.day, slot: slot?.type === "workout" ? slot : null, session: s });
}

/** Today's options: the planned workout, any other workout from the program, or a free workout. */
export function renderSwap(): string {
  const run = activeRun();
  if (!run) return noProgram();
  const next = projection(run).next;
  const planned = next ? runSlot(run, next) : null;
  const choices = workoutChoices(run.programRef, store.state.programs).map((c) => ({ ...c, target: firstOpenDayFor(run, c.key, next ?? 1) }));
  return `
    ${pageHeader("Change today's workout", { back: "#/today", backLabel: "Today", sub: "Do a different workout from your program today. Your planned day stays next up, so nothing is lost." })}
    <ul class="card list-rows swap-list">
      ${choices.map((c) => `<li>${c.target
        ? `<a class="list-row list-row--link" href="#/day/${c.target}">
            <span class="list-row__day">${esc(c.short)}</span>
            <span class="list-row__main">${esc(c.name)}<small>Counts as day ${c.target}${planned?.type === "workout" && planned.key === c.key && c.target === next ? " · your planned workout" : ""}</small></span>${ICON.chevron}</a>`
        : `<span class="list-row is-disabled"><span class="list-row__day">${esc(c.short)}</span><span class="list-row__main">${esc(c.name)}<small>All done in this program</small></span></span>`}</li>`).join("")}
    </ul>
    <h2 class="section__title section__title--spaced">Something else</h2>
    <button class="routine-card routine-card--free" data-action="free-workout">
      <span class="routine-card__icon">${ICON.plus}</span>
      <span class="routine-card__text"><small>Not part of your program</small><strong>Free workout</strong><span>Pick any exercises. It's logged on your calendar.</span></span>
      ${ICON.chevron}
    </button>`;
}

/** First day (preferring from `from` onwards) of a workout that hasn't been done or skipped. */
function firstOpenDayFor(run: Run, key: string, from: number): number | null {
  const last = runLength(run) ?? from + 400;
  for (const start of [from, 1]) {
    for (let d = start; d <= last; d++) {
      if (run.days[d]) continue;
      const s = runSlot(run, d);
      if (!s) break;
      if (s.type === "workout" && s.key === key) return d;
    }
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * Workout view (program day or logged session)
 * ------------------------------------------------------------------------- */

interface ViewCtx {
  run: Run | null;
  day: number | null;
  slot: Extract<Slot, { type: "workout" }> | null;
  session: Session | null;
}

function groupExercises(list: ProgramExercise[]) {
  const groups: { superset: string | null; items: { ex: ProgramExercise; index: number }[] }[] = [];
  list.forEach((ex, index) => {
    const last = groups[groups.length - 1];
    if (ex.superset && last && last.superset === ex.superset) last.items.push({ ex, index });
    else groups.push({ superset: ex.superset ?? null, items: [{ ex, index }] });
  });
  return groups;
}

function workoutView({ run, day, slot, session }: ViewCtx) {
  const plan = session ? sessionPlan(session) : slot?.exercises ?? [];
  const title = session?.title ?? slot?.name ?? "Workout";
  const free = !session?.runId && !slot;
  const done = session?.status === "done";
  const intensity: Intensity | undefined = slot?.intensity;
  const workoutKey = session?.workoutKey ?? slot?.key ?? null;
  const isNext = !!run && day != null && projection(run).next === day;
  const back = session && !session.runId ? "#/calendar" : isNext ? "#/today" : "#/calendar";

  const eyebrow = free
    ? `Free workout · ${esc(relDate(session?.date ?? todayISO()))}`
    : `${run ? esc(runProgramName(run)) : "Program"} · Day ${day}${slot?.cycle ? ` · Cycle ${slot.cycle}` : ""}`;

  const opts = { session, workoutKey, intensity, removable: free };
  const body = plan.length
    ? groupExercises(plan).map((g) => {
        if (!g.superset) return exerciseCard(g.items[0]!.ex, g.items[0]!.index, opts);
        return `<section class="superset" aria-label="Superset ${g.superset}">
          <header class="superset__head"><span class="superset__tag">Superset ${g.superset}</span><span class="superset__hint">Go straight from one to the next</span></header>
          ${g.items.map((it, i) => (i ? '<div class="superset__join" aria-hidden="true">+</div>' : "") + exerciseCard(it.ex, it.index, opts)).join("")}
        </section>`;
      }).join("")
    : emptyState("No exercises yet.", "Add the exercises you're doing below.");

  const letter = slot?.letter;
  const routineKey = letter ?? "full";
  const routineBack = run && day != null && !free ? String(day) : session ? `log:${session.id}` : "";
  const exerciseNames = knownExercises(builtinExercises());

  return `
    <div class="workout" data-run="${run?.id ?? ""}" data-day="${day ?? ""}" data-session="${session?.id ?? ""}"
      data-key="${esc(workoutKey ?? "")}" data-title="${esc(title)}" data-intensity="${intensity ?? ""}">
      <header class="page-head">
        <a class="back" href="${back}">${ICON.back}<span>${back === "#/today" ? "Today" : "Calendar"}</span></a>
        <p class="eyebrow">${eyebrow}</p>
        <h1 class="page-title">${esc(title)}</h1>
        <p class="workout__meta">
          ${letter ? `<span class="workout__letter">Workout ${letter}</span>` : slot ? `<span class="workout__letter">${esc(slot.short)}</span>` : ""}
          ${intensity ? pill(intensity) : ""}
          <span class="muted">${plural(plan.length, "exercise")}</span>
          ${isNext && !done ? `<a class="workout__swap" href="#/swap">${ICON.refresh}<span>Swap</span></a>` : ""}
        </p>
      </header>
      ${done ? `<div class="notice notice--ok">${ICON.check}<span>Completed. You can still edit your log.</span></div>` : ""}
      <div class="workout__date">
        <label for="session-date">Trained on</label>
        <input id="session-date" type="date" class="input input--compact" value="${session?.date ?? todayISO()}" max="${todayISO()}" data-change="session-date">
      </div>
      ${intensity ? guidance(intensity, plan.some((e) => e.superset)) : ""}
      ${letter ? `<div class="workout__links">
        <a class="text-link" href="${VIDEO_URL}" target="_blank" rel="noopener noreferrer" data-video
          aria-label="Programme video trainer (opens in a new tab)">${ICON.play}<span>Programme video trainer</span>${ICON.link}</a>
        <p class="muted">Breathing cues are general tips, not part of the programme PDF.</p>
      </div>` : ""}
      ${routineBack ? routineCard(WARMUPS[routineKey], routineBack, "Before you start") : ""}
      <div class="exercises">${body}</div>
      <details class="add-ex card" ${free && !plan.length ? "open" : ""}>
        <summary>${ICON.plus}<span>Add an exercise</span></summary>
        <form class="add-ex__form" data-form="add-exercise" novalidate>
          <div class="field">
            <label for="ax-name">Exercise</label>
            <input id="ax-name" name="name" class="input" list="ax-list" autocomplete="off" maxlength="60" placeholder="e.g. Bench Press" required>
            <datalist id="ax-list">${exerciseNames.map((e) => `<option value="${esc(e.name)}">`).join("")}</datalist>
          </div>
          <div class="form__row">
            <div class="field"><label for="ax-sets">Sets</label><input id="ax-sets" name="sets" class="input" inputmode="numeric" value="3"></div>
            <div class="field"><label for="ax-reps">Target reps</label><input id="ax-reps" name="reps" class="input" inputmode="numeric" placeholder="Optional"></div>
          </div>
          <p class="field__err" id="ax-err" role="alert" hidden></p>
          <button class="btn btn--ghost btn--block" type="submit">Add exercise</button>
        </form>
      </details>
      ${routineBack ? routineCard(STRETCHES[routineKey], routineBack, "After your last set") : ""}
      ${session ? `<p class="workout__delete"><button class="link-btn link-btn--danger" data-action="delete-session">${ICON.close}<span>Delete this workout log</span></button></p>` : ""}
      <div class="actionbar" id="actionbar">
        <div class="actionbar__inner">
          <div class="actionbar__info" id="ab-info">${actionInfo(plan, session)}</div>
          ${done
            ? `<button class="btn btn--ghost" data-action="uncomplete-workout">Mark not done</button>`
            : `<button class="btn btn--primary" data-action="complete-workout" id="complete-btn">Complete workout</button>`}
        </div>
      </div>
    </div>`;
}

/** Entry to a guided warm-up / stretch session (general routine, not from the PDF). */
function routineCard(r: Routine, back: string, when: string) {
  return `<a class="routine-card routine-card--${r.kind}" href="#/session/${r.kind}/${r.key}/${back}">
    <span class="routine-card__icon">${r.kind === "warmup" ? ICON.play : ICON.leaf}</span>
    <span class="routine-card__text"><small>${when}</small><strong>${r.kind === "warmup" ? "Warm-up" : "Cool-down stretch"} · ${routineMinutes(r)} min</strong>
      <span>${plural(r.moves.length, "move")} · guided timer</span></span>
    ${ICON.chevron}
  </a>`;
}

function actionInfo(plan: ProgramExercise[], s: Session | null) {
  const p = sessionProgress(plan, s);
  return `<span class="ab-progress"><span><strong>${p.exDone}</strong>/${p.exTotal} exercises</span><small>${p.setsDone}/${p.setsTotal} sets</small></span>`;
}

/* ===========================================================================
 * Interactions (called from app.ts event delegation)
 * ========================================================================= */

interface WorkoutCtx { el: HTMLElement; run: Run | null; day: number | null; session: Session | null; plan: ProgramExercise[]; intensity?: Intensity }

export function currentWorkout(): WorkoutCtx | null {
  const el = $(".workout");
  if (!el) return null;
  const run = el.dataset.run ? store.state.runs[el.dataset.run] ?? null : null;
  const day = el.dataset.day ? Number(el.dataset.day) : null;
  const session = el.dataset.session ? store.state.sessions[el.dataset.session] ?? null : null;
  const slot = run && day ? runSlot(run, day) : null;
  const plan = session ? sessionPlan(session) : slot?.type === "workout" ? slot.exercises : [];
  return { el, run, day, session, plan, intensity: (el.dataset.intensity as Intensity) || undefined };
}

/** The session for this screen, creating it (dated today) on first use. */
export function ensureSession(w: WorkoutCtx): Session {
  if (w.session) return w.session;
  const s = createSession({
    runId: w.run?.id ?? null, day: w.run ? w.day : null, workoutKey: w.el.dataset.key || null,
    title: w.el.dataset.title || "Workout", plan: w.plan,
  });
  w.el.dataset.session = s.id;
  w.session = s;
  return s;
}

function ctxOf(el: Element) {
  const w = currentWorkout()!;
  const card = el.closest<HTMLElement>(".ex");
  const row = el.closest<HTMLElement>(".set");
  const ex = card ? w.plan[Number(card.dataset.index)] ?? null : null;
  return { w, card, row, ex, i: row ? Number(row.dataset.set) : -1 };
}

function showSetError(row: HTMLElement, msg: string) {
  const err = $(".set__err", row)!;
  err.textContent = msg;
  err.hidden = !msg;
}

type Parsed = { value: number | null; error?: undefined } | { error: string; value?: undefined };

export function parseField(field: "weight" | "reps", raw: string): Parsed {
  const v = raw.trim().replace(",", ".");
  if (v === "") return { value: null };
  const n = Number(v);
  if (field === "weight") {
    if (!Number.isFinite(n) || n < 0 || n > maxWeight()) return { error: `Enter a weight between 0 and ${maxWeight()} ${unit()}.` };
    return { value: displayToKg(n) };
  }
  if (!Number.isInteger(n) || n < 0 || n > 200) return { error: "Reps must be a whole number from 0 to 200." };
  return { value: n };
}

const rowCount = (card: HTMLElement) => $$(".set", card).length;

export function onSetInput(input: HTMLInputElement) {
  const { w, card, row, ex, i } = ctxOf(input);
  if (!ex || !row || !card) return;
  const field = input.dataset.field as "weight" | "reps";
  const res = parseField(field, input.value);
  input.setAttribute("aria-invalid", res.error ? "true" : "false");
  showSetError(row, res.error ?? "");
  if (res.error) return;
  const s = ensureSession(w);
  getOrCreateLog(s, ex.code, rowCount(card)).sets[i]![field] = res.value ?? null;
  touch(s);
}

export function onNotesInput(ta: HTMLTextAreaElement) {
  const { w, card, ex } = ctxOf(ta);
  if (!ex || !card) return;
  const s = ensureSession(w);
  getOrCreateLog(s, ex.code, rowCount(card)).notes = ta.value.slice(0, 2000);
  touch(s);
}

export function stepField(btn: HTMLElement) {
  const { row } = ctxOf(btn);
  if (!row) return;
  const field = btn.dataset.field as "weight" | "reps";
  const input = $<HTMLInputElement>(`input[data-field="${field}"]`, row)!;
  const raw = input.value.trim() !== "" ? input.value : input.placeholder;
  const base = Number(raw.replace(",", ".")) || 0;
  const step = field === "weight" ? weightStep() : 1;
  input.value = String(Math.max(0, round2(base + step * Number(btn.dataset.dir))));
  onSetInput(input);
}

export function toggleSet(btn: HTMLElement) {
  const { w, card, row, ex, i } = ctxOf(btn);
  if (!row || !card || !ex) return;
  const s = ensureSession(w);
  const set = getOrCreateLog(s, ex.code, rowCount(card)).sets[i]!;

  if (!set.done) {
    const rIn = $<HTMLInputElement>('input[data-field="reps"]', row)!;
    // Minimal typing: an empty field logs its placeholder (last weight / target reps).
    for (const field of ["weight", "reps"] as const) {
      const inp = $<HTMLInputElement>(`input[data-field="${field}"]`, row)!;
      if (inp.value.trim() === "" && inp.placeholder && inp.placeholder !== "–") inp.value = inp.placeholder;
      const res = parseField(field, inp.value);
      if (res.error) { showSetError(row, res.error); inp.focus(); return; }
      set[field] = res.value ?? null;
    }
    if (set.reps == null) {
      showSetError(row, "Enter the reps you did, then tick the set.");
      rIn.focus();
      return;
    }
    showSetError(row, "");
    set.done = true;
  } else {
    set.done = false;
  }
  touch(s);

  row.classList.toggle("is-done", set.done);
  btn.setAttribute("aria-pressed", String(set.done));
  if (set.done) {
    row.classList.remove("pop"); void row.offsetWidth; row.classList.add("pop");
    carryForward(card, i, set.weight);
  }
  refreshExercise(card, s, ex.code, ex.name);
  refreshActionBar();

  if (set.done) {
    const group = w.plan.filter((e) => e.superset && e.superset === ex.superset);
    const pos = group.findIndex((e) => e.code === ex.code);
    if (group.length && pos < group.length - 1) showNextHint(group[pos + 1]!.name);
    else startRestTimer(w.intensity);
  }
}

/** Add one more set row to an exercise (re-render keeps scroll). */
export function addSet(btn: HTMLElement) {
  const { w, card, ex } = ctxOf(btn);
  if (!card || !ex) return;
  const s = ensureSession(w);
  getOrCreateLog(s, ex.code, Math.min(rowCount(card) + 1, 10));
  touch(s);
}

export function removeExercise(btn: HTMLElement) {
  const { w, ex } = ctxOf(btn);
  if (!ex) return;
  const s = ensureSession(w);
  s.plan = s.plan.filter((e) => e.code !== ex.code);
  delete s.logs[ex.code];
  touch(s);
}

/** Add-exercise form. Returns an error message, or null on success. */
export function addExercise(form: HTMLFormElement): string | null {
  const w = currentWorkout();
  if (!w) return "Something went wrong.";
  const val = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value.trim();
  const name = val("name");
  const sets = Number(val("sets") || "3");
  const repsRaw = val("reps");
  const reps = repsRaw ? Number(repsRaw) : null;
  if (!name) return "Enter an exercise name.";
  if (!Number.isInteger(sets) || sets < 1 || sets > 10) return "Sets must be a whole number from 1 to 10.";
  if (reps != null && (!Number.isInteger(reps) || reps < 1 || reps > 100)) return "Reps must be a whole number from 1 to 100, or left empty.";
  const known = knownExercises(builtinExercises());
  const code = codeForName(name, known);
  const s = ensureSession(w);
  if (s.plan.length === 0 && w.plan.length) s.plan = w.plan.map((e) => ({ ...e }));
  if (s.plan.some((e) => e.code === code)) return "That exercise is already in this workout.";
  const display = known.find((k) => k.code === code)?.name ?? name;
  s.plan.push({ code, name: display, sets, reps });
  touch(s);
  return null;
}

/** Suggest the weight just used for this exercise's remaining empty sets (placeholder only). */
function carryForward(card: HTMLElement, from: number, weightKg: number | null) {
  if (weightKg == null) return;
  $$<HTMLElement>(".set", card).slice(from + 1).forEach((r) => {
    const inp = $<HTMLInputElement>('input[data-field="weight"]', r)!;
    if (!r.classList.contains("is-done") && inp.value.trim() === "") inp.placeholder = fmtW(weightKg);
  });
}

function refreshExercise(card: HTMLElement, s: Session, code: string, name: string) {
  const total = rowCount(card);
  const n = s.logs[code]?.sets.filter((x) => x.done).length ?? 0;
  const done = n >= total;
  const was = card.classList.contains("is-done");
  card.classList.toggle("is-done", done);
  $(".ex__status", card)!.innerHTML = exerciseStatus(n, total);
  if (done && !was) toast(`${name} done`);
}

export function refreshActionBar() {
  const w = currentWorkout();
  const info = $("#ab-info");
  if (!w || !info || timer) return;
  info.innerHTML = actionInfo(w.plan, w.session);
  const p = sessionProgress(w.plan, w.session);
  $("#complete-btn")?.classList.toggle("is-ready", p.setsTotal > 0 && p.setsDone === p.setsTotal);
}

/** "Trained on" date changed. */
export function onSessionDate(input: HTMLInputElement) {
  const w = currentWorkout();
  if (!w || !input.value || input.value > todayISO()) { input.value = w?.session?.date ?? todayISO(); return; }
  setSessionDate(ensureSession(w), input.value);
  toast(`Logged on ${fmtDate(input.value)}`);
}

/* ---------- Rest timer: counts up; shows the source's rest target on built-in days. ---------- */
let timer: ReturnType<typeof setInterval> | null = null;
let releaseScreen: (() => void) | null = null;

function startRestTimer(intensity?: Intensity) {
  stopRestTimer();
  unlockAudio(); // called from the set-tick tap, so the end-of-rest beep is allowed
  const info = $("#ab-info");
  if (!info) return;
  const started = Date.now();
  const I = intensity ? INTENSITY[intensity] : null;
  const tick = () => {
    const sec = Math.floor((Date.now() - started) / 1000);
    const mm = Math.floor(sec / 60), ss = String(sec % 60).padStart(2, "0");
    if (I && sec === I.restSeconds) cue.go(store.state.settings.sound); // rest target reached
    const over = I ? sec >= I.restSeconds : false;
    info.innerHTML = `<button class="rest-chip ${over ? "is-over" : ""}" data-action="stop-timer"
      aria-label="Rest ${mm} minutes ${ss} seconds.${I ? ` Target ${I.restTarget}.` : ""} Tap to dismiss.">
      ${ICON.timer}<span class="rest-chip__stack"><span class="rest-chip__time">${mm}:${ss}</span><small>Rest${I ? ` · ${I.restTarget}` : ""}</small></span>${ICON.close}</button>`;
  };
  timer = setInterval(tick, 1000);
  releaseScreen = holdScreenOn(); // keep the screen on while resting
  tick();
}

function showNextHint(name: string) {
  stopRestTimer();
  const info = $("#ab-info");
  if (!info) return;
  info.innerHTML = `<span class="next-hint"><small>Superset · no rest</small><strong>Next: ${esc(name)}</strong></span>`;
  timer = setTimeout(() => { timer = null; refreshActionBar(); }, 6000);
}

export function stopRestTimer() {
  if (timer) { clearInterval(timer); clearTimeout(timer); timer = null; }
  releaseScreen?.();
  releaseScreen = null;
}

/** Enter moves to the next numeric field, for fast one-handed entry. */
export function focusNextField(from: HTMLInputElement) {
  const inputs = $$<HTMLInputElement>(".stepper__input");
  const next = inputs[inputs.indexOf(from) + 1];
  if (next) next.focus(); else from.blur();
}

