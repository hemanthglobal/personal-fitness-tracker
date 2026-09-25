/* Day screen: a workout (logging UI) or a rest day. Includes the in-place set interactions. */
import { getSchedule, INTENSITY, VIDEO_URL } from "../data/workout-data";
import type { Exercise, WorkoutSchedule } from "../types/workout";
import { restHero } from "../components/day-card";
import { exerciseCard, exerciseStatus } from "../components/exercise-card";
import { ICON } from "../components/icons";
import { toast } from "../components/toast";
import { emptyState, guidance, pageHeader, pill } from "../components/ui";
import {
  changed, currentDay, dateForDay, displayToKg, fmtW, getLog, getOrCreateLog, isDayComplete, maxWeight, store, unit, weightStep, workoutProgress,
} from "../lib/state";
import { $, $$, esc, fmtDate, plural, round2 } from "../lib/utils";

export function renderDay(param?: string): string {
  const day = Number(param);
  const sched = getSchedule(day);
  if (!sched) {
    return `${pageHeader("Day not found", { back: "#/calendar", backLabel: "Calendar" })}
      ${emptyState("That day doesn't exist.", "The programme runs from Day 1 to Day 60.", '<a class="btn btn--primary" href="#/calendar">Open calendar</a>')}`;
  }
  const today = currentDay();
  const rel = day === today ? "Today" : day === today + 1 ? "Tomorrow" : day === today - 1 ? "Yesterday" : fmtDate(dateForDay(day));
  const eyebrow = `Day ${day} · Cycle ${sched.cycle} · ${esc(rel)}`;

  if (sched.type === "rest") {
    return `${pageHeader("Rest day", { back: "#/calendar", backLabel: "Calendar", eyebrow })}
      ${restHero(day, "Recovery")}
      <p class="fineprint">Nothing to log. Mark it complete when the day is done, or leave it.</p>`;
  }
  return workoutView(sched, eyebrow);
}

function groupExercises(list: Exercise[]) {
  const groups: { superset: string | null; items: { ex: Exercise; index: number }[] }[] = [];
  list.forEach((ex, index) => {
    const last = groups[groups.length - 1];
    if (ex.superset && last && last.superset === ex.superset) last.items.push({ ex, index });
    else groups.push({ superset: ex.superset ?? null, items: [{ ex, index }] });
  });
  return groups;
}

function workoutView(sched: WorkoutSchedule, eyebrow: string) {
  const day = sched.day;
  const complete = isDayComplete(day);
  const completedAt = complete && store.state.days[day]?.completedAt
    ? new Date(store.state.days[day]!.completedAt!).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "";

  const body = groupExercises(sched.exercises).map((g) => {
    if (!g.superset) return exerciseCard(sched, g.items[0]!.ex, g.items[0]!.index);
    return `<section class="superset" aria-label="Superset ${g.superset}">
      <header class="superset__head"><span class="superset__tag">Superset ${g.superset}</span><span class="superset__hint">Go straight from one to the next</span></header>
      ${g.items.map((it, i) => (i ? '<div class="superset__join" aria-hidden="true">+</div>' : "") + exerciseCard(sched, it.ex, it.index)).join("")}
    </section>`;
  }).join("");

  return `
    <div class="workout" data-day="${day}">
      <header class="page-head">
        <a class="back" href="#/calendar">${ICON.back}<span>Calendar</span></a>
        <p class="eyebrow">${eyebrow}</p>
        <h1 class="page-title">${esc(sched.name)}</h1>
        <p class="workout__meta"><span class="workout__letter">Workout ${sched.workout}</span>${pill(sched.intensity)}<span class="muted">${plural(sched.exercises.length, "exercise")}</span></p>
      </header>
      ${complete ? `<div class="notice notice--ok">${ICON.check}<span>Completed${completedAt ? ` · ${esc(completedAt)}` : ""}. You can still edit your log.</span></div>` : ""}
      ${guidance(sched.intensity, sched.exercises.some((e) => e.superset))}
      <div class="workout__links">
        <a class="text-link" href="${VIDEO_URL}" target="_blank" rel="noopener noreferrer" data-video
          aria-label="Programme video trainer (opens in a new tab)">${ICON.play}<span>Programme video trainer</span>${ICON.link}</a>
        <p class="muted">Breathing cues are general tips, not part of the programme PDF.</p>
      </div>
      <div class="exercises">${body}</div>
      <div class="actionbar" id="actionbar">
        <div class="actionbar__inner">
          <div class="actionbar__info" id="ab-info">${actionInfo(sched)}</div>
          ${complete
            ? `<button class="btn btn--ghost" data-action="uncomplete-workout">Mark not done</button>`
            : `<button class="btn btn--primary" data-action="complete-workout" id="complete-btn">Complete workout</button>`}
        </div>
      </div>
    </div>`;
}

function actionInfo(sched: WorkoutSchedule) {
  const p = workoutProgress(sched);
  return `<span class="ab-progress"><span><strong>${p.exDone}</strong>/${p.exTotal} exercises</span><small>${p.setsDone}/${p.setsTotal} sets</small></span>`;
}

/* ===========================================================================
 * Interactions (called from app.ts event delegation)
 * ========================================================================= */

export function currentWorkout(): WorkoutSchedule | null {
  const w = $(".workout");
  const s = w ? getSchedule(Number(w.dataset.day)) : null;
  return s && s.type === "workout" ? s : null;
}

function ctxOf(el: Element) {
  const sched = currentWorkout()!;
  const card = el.closest<HTMLElement>(".ex")!;
  const row = el.closest<HTMLElement>(".set");
  const ex = sched.exercises[Number(card.dataset.index)]!;
  return { sched, card, row, ex, i: row ? Number(row.dataset.set) : -1 };
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

export function onSetInput(input: HTMLInputElement) {
  const { sched, row, ex, i } = ctxOf(input);
  const field = input.dataset.field as "weight" | "reps";
  const res = parseField(field, input.value);
  input.setAttribute("aria-invalid", res.error ? "true" : "false");
  showSetError(row!, res.error ?? "");
  if (res.error) return;
  getOrCreateLog(sched.day, ex.code, ex.sets).sets[i]![field] = res.value ?? null;
  changed(`day:${sched.day}`);
}

export function onNotesInput(ta: HTMLTextAreaElement) {
  const { sched, ex } = ctxOf(ta);
  getOrCreateLog(sched.day, ex.code, ex.sets).notes = ta.value.slice(0, 2000);
  changed(`day:${sched.day}`);
}

export function stepField(btn: HTMLElement) {
  const { row } = ctxOf(btn);
  const field = btn.dataset.field as "weight" | "reps";
  const input = $<HTMLInputElement>(`input[data-field="${field}"]`, row!)!;
  const raw = input.value.trim() !== "" ? input.value : input.placeholder;
  const base = Number(raw.replace(",", ".")) || 0;
  const step = field === "weight" ? weightStep() : 1;
  input.value = String(Math.max(0, round2(base + step * Number(btn.dataset.dir))));
  onSetInput(input);
}

export function toggleSet(btn: HTMLElement) {
  const { sched, card, row, ex, i } = ctxOf(btn);
  if (!row) return;
  const set = getOrCreateLog(sched.day, ex.code, ex.sets).sets[i]!;

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
  changed(`day:${sched.day}`);

  row.classList.toggle("is-done", set.done);
  btn.setAttribute("aria-pressed", String(set.done));
  if (set.done) {
    row.classList.remove("pop"); void row.offsetWidth; row.classList.add("pop");
    carryForward(card, i, set.weight);
  }
  refreshExercise(card, sched, ex);
  refreshActionBar();

  if (set.done) {
    const group = sched.exercises.filter((e) => e.superset && e.superset === ex.superset);
    const pos = group.indexOf(ex);
    if (group.length && pos < group.length - 1) showNextHint(group[pos + 1]!);
    else startRestTimer(sched);
  }
}

/** Suggest the weight just used for this exercise's remaining empty sets (placeholder only). */
function carryForward(card: HTMLElement, from: number, weightKg: number | null) {
  if (weightKg == null) return;
  $$<HTMLElement>(".set", card).slice(from + 1).forEach((r) => {
    const w = $<HTMLInputElement>('input[data-field="weight"]', r)!;
    if (!r.classList.contains("is-done") && w.value.trim() === "") w.placeholder = fmtW(weightKg);
  });
}

function refreshExercise(card: HTMLElement, sched: WorkoutSchedule, ex: Exercise) {
  const n = getLog(sched.day, ex.code)?.sets.slice(0, ex.sets).filter((s) => s.done).length ?? 0;
  const done = n >= ex.sets;
  const was = card.classList.contains("is-done");
  card.classList.toggle("is-done", done);
  $(".ex__status", card)!.innerHTML = exerciseStatus(n, ex.sets);
  if (done && !was) toast(`${ex.name} done`);
}

export function refreshActionBar() {
  const sched = currentWorkout();
  const info = $("#ab-info");
  if (!sched || !info || timer) return;
  info.innerHTML = actionInfo(sched);
  const p = workoutProgress(sched);
  $("#complete-btn")?.classList.toggle("is-ready", p.setsDone === p.setsTotal);
}

/* ---------- Rest timer: counts up; shows the source's rest target. ---------- */
let timer: ReturnType<typeof setInterval> | null = null;

function startRestTimer(sched: WorkoutSchedule) {
  stopRestTimer();
  const info = $("#ab-info");
  if (!info) return;
  const started = Date.now();
  const I = INTENSITY[sched.intensity];
  const tick = () => {
    const sec = Math.floor((Date.now() - started) / 1000);
    const mm = Math.floor(sec / 60), ss = String(sec % 60).padStart(2, "0");
    info.innerHTML = `<button class="rest-chip ${sec >= I.restSeconds ? "is-over" : ""}" data-action="stop-timer"
      aria-label="Rest ${mm} minutes ${ss} seconds. Target ${I.restTarget}. Tap to dismiss.">
      ${ICON.timer}<span class="rest-chip__stack"><span class="rest-chip__time">${mm}:${ss}</span><small>Rest · ${I.restTarget}</small></span>${ICON.close}</button>`;
  };
  timer = setInterval(tick, 1000);
  tick();
}

function showNextHint(next: Exercise) {
  stopRestTimer();
  const info = $("#ab-info");
  if (!info) return;
  info.innerHTML = `<span class="next-hint"><small>Superset · no rest</small><strong>Next: ${esc(next.name)}</strong></span>`;
  timer = setTimeout(() => { timer = null; refreshActionBar(); }, 6000);
}

export function stopRestTimer() {
  if (timer) { clearInterval(timer); clearTimeout(timer); timer = null; }
}

/** Enter moves to the next numeric field, for fast one-handed entry. */
export function focusNextField(from: HTMLInputElement) {
  const inputs = $$<HTMLInputElement>(".stepper__input");
  const next = inputs[inputs.indexOf(from) + 1];
  if (next) next.focus(); else from.blur();
}
