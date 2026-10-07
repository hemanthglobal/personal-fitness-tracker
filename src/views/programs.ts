/*
 * Programs:
 *   #/programs                 — active program, start another, your programs, history
 *   #/program/start/<ref>      — pick a start date and start a program
 *   #/program/new[/template]   — program builder (blank, or from the PPL + Upper/Lower template)
 *   #/program/edit/<id>        — edit one of your programs
 */
import {
  BUILTIN_60, builtinExercises, codeForName, customIdOf, programLength, programRef, pplTemplate, shortFor, type CustomProgram,
} from "../data/programs";
import { finishLine } from "../components/day-card";
import { ICON } from "../components/icons";
import { emptyState, pageHeader } from "../components/ui";
import { activeRun, changed, currentDay, knownExercises, resolvedCount, runLength, runProgramName, store, uuid } from "../lib/state";
import { esc, fmtDate, plural, todayISO } from "../lib/utils";

const patternSummary = (p: CustomProgram) =>
  p.pattern.map((k) => (k == null ? "Rest" : p.workouts.find((w) => w.key === k)?.name ?? "?")).join(" · ");

const lengthLabel = (p: CustomProgram) =>
  p.repeats == null ? "Repeats until you stop" : `${p.pattern.length * p.repeats} days${p.pattern.length === 7 ? ` (${p.repeats} weeks)` : ` (${p.repeats}×)`}`;

/* ---------------------------------------------------------------------------
 * List
 * ------------------------------------------------------------------------- */

export function renderPrograms(): string {
  const run = activeRun();
  const s = store.state;
  const mine = Object.values(s.programs).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const history = Object.values(s.runs).filter((r) => r.id !== run?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const activeCard = run
    ? `<section class="card program-active">
        <p class="eyebrow">Active program</p>
        <p class="program-active__name">${esc(runProgramName(run))}</p>
        <p class="muted">${run.status === "finished" ? "Finished" : `Day ${Math.max(currentDay() ?? 1, 1)}${runLength(run) ? ` of ${runLength(run)}` : ""}`} · started ${esc(fmtDate(run.startDate, { day: "numeric", month: "short", year: "numeric" }))}</p>
        <p class="muted">${esc(finishLine(run))}</p>
        <div class="btn-row">
          <a class="btn btn--primary" href="#/today">Go to today</a>
          <a class="btn btn--ghost" href="#/progress">View plan</a>
          <button class="btn btn--danger-ghost" data-action="end-run">End program</button>
        </div>
      </section>`
    : `<section class="card program-active program-active--none"><p class="program-active__name">No program running</p>
        <p class="muted">Start one below. Free workouts are always available from Today.</p></section>`;

  const builtin = `<li class="program-row">
      <div class="program-row__main"><strong>60 Days to Fit</strong><small>Built-in · 60 days · 5 cycles of light & heavy training (from the PDF)</small></div>
      <div class="program-row__actions">
        <a class="btn btn--ghost btn--sm" href="#/about">About</a>
        ${run?.programRef === BUILTIN_60 && run.status === "active" ? `<span class="tag">Active</span>` : `<a class="btn btn--primary btn--sm" href="#/program/start/${BUILTIN_60}">Start</a>`}
      </div>
    </li>`;

  const mineRows = mine.map((p) => {
    const isActive = run?.programRef === programRef(p.id) && run.status === "active";
    return `<li class="program-row">
      <div class="program-row__main"><strong>${esc(p.name)}</strong><small>${esc(patternSummary(p))}</small><small>${esc(lengthLabel(p))} · ${plural(p.workouts.length, "workout")}</small></div>
      <div class="program-row__actions">
        <a class="btn btn--ghost btn--sm" href="#/program/edit/${p.id}">Edit</a>
        ${isActive ? `<span class="tag">Active</span>` : `<a class="btn btn--primary btn--sm" href="#/program/start/${programRef(p.id)}">Start</a>`}
      </div>
    </li>`;
  }).join("");

  return `
    ${pageHeader("Programs", { back: "#/more", sub: "Run one program at a time. Switching keeps your history and every logged workout." })}
    ${activeCard}
    <h2 class="section__title section__title--spaced">Start a program</h2>
    <ul class="card program-list">${builtin}${mineRows}</ul>
    <div class="btn-row section">
      <a class="btn btn--ghost" href="#/program/new">${ICON.plus}<span>New program</span></a>
      <a class="btn btn--ghost" href="#/program/new/template">Use the PPL + Upper/Lower template</a>
    </div>
    <h2 class="section__title section__title--spaced">History</h2>
    ${history.length
      ? `<ul class="card list-rows">${history.map((r) => {
          const len = programLength(r.programRef, s.programs);
          return `<li class="list-row">
            <span class="list-row__main">${esc(r.name)}<small>${esc(fmtDate(r.startDate, { day: "numeric", month: "short", year: "numeric" }))}${r.endedAt ? ` – ${esc(fmtDate(r.endedAt.slice(0, 10), { day: "numeric", month: "short", year: "numeric" }))}` : ""}</small></span>
            <span class="list-row__value">${resolvedCount(r, "done")}${len ? `/${len}` : ""} days</span>
            <span class="tag tag--quiet">${r.status === "finished" ? "Finished" : r.status === "ended" ? "Ended" : "Active"}</span>
          </li>`;
        }).join("")}</ul>`
      : emptyState("No past programs yet.", "When you finish or switch programs, they're listed here.")}`;
}

/* ---------------------------------------------------------------------------
 * Start
 * ------------------------------------------------------------------------- */

export function renderProgramStart(ref?: string, ...rest: string[]): string {
  const full = [ref, ...rest].filter(Boolean).join("/");
  const s = store.state;
  const custom = s.programs[customIdOf(full) ?? ""];
  if (full !== BUILTIN_60 && !custom) {
    return `${pageHeader("Program not found", { back: "#/programs" })}${emptyState("That program doesn't exist.", "It may have been deleted.", '<a class="btn btn--primary" href="#/programs">Programs</a>')}`;
  }
  const name = custom?.name ?? "60 Days to Fit";
  const run = activeRun();
  const len = programLength(full, s.programs);
  return `
    ${pageHeader(`Start ${esc(name)}`, { back: "#/programs", backLabel: "Programs" })}
    <section class="card form">
      ${custom ? `<div><p class="label">Day pattern</p><p>${esc(patternSummary(custom))}</p><p class="muted">${esc(lengthLabel(custom))}</p></div>`
        : `<p class="muted">60 days in 5 cycles: 8 workouts and 4 rest days per cycle, light and heavy days for each body part.</p>`}
      <form data-form="start-program" data-ref="${esc(full)}" novalidate class="form" style="padding:0">
        <div class="field">
          <label for="sp-date">Start date</label>
          <input id="sp-date" name="startDate" type="date" class="input" value="${todayISO()}" required>
          <p class="field__help">Day 1 is this date. ${len ? `If you train every planned day you'll finish ${plural(len, "day")} later; skipped days move the plan back.` : "It runs until you stop it."}</p>
        </div>
        ${run && run.status === "active" ? `<div class="notice">${ICON.info}<span>This ends <strong>${esc(runProgramName(run))}</strong>. Its history and logs are kept.</span></div>` : ""}
        <p class="field__err" id="sp-err" role="alert" hidden></p>
        <button class="btn btn--primary btn--lg btn--block" type="submit">Start program</button>
      </form>
    </section>`;
}

/* ---------------------------------------------------------------------------
 * Builder
 * ------------------------------------------------------------------------- */

interface DraftExercise { name: string; sets: number; reps: number | null; code?: string }
interface DraftWorkout { key: string; name: string; exercises: DraftExercise[] }
interface Draft { id: string | null; name: string; workouts: DraftWorkout[]; pattern: (string | null)[]; repeats: number | null; repeatsValue: number }

let draft: Draft | null = null;
let draftRoute = "";

const newKey = () => `w${Math.random().toString(36).slice(2, 8)}`;

function draftFrom(p: Omit<CustomProgram, "id" | "createdAt" | "updatedAt">, id: string | null): Draft {
  return {
    id,
    name: p.name,
    workouts: p.workouts.map((w) => ({ key: w.key, name: w.name, exercises: w.exercises.map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, code: e.code })) })),
    pattern: [...p.pattern],
    repeats: p.repeats,
    repeatsValue: p.repeats ?? 8,
  };
}

function blankDraft(): Draft {
  const a = newKey(), b = newKey();
  return {
    id: null, name: "",
    workouts: [
      { key: a, name: "Workout A", exercises: [{ name: "", sets: 3, reps: 10 }] },
      { key: b, name: "Workout B", exercises: [{ name: "", sets: 3, reps: 10 }] },
    ],
    pattern: [a, b, null],
    repeats: 8, repeatsValue: 8,
  };
}

export function renderBuilder(mode?: string, id?: string): string {
  const route = location.hash;
  if (!draft || draftRoute !== route) {
    draftRoute = route;
    if (mode === "edit") {
      const p = id ? store.state.programs[id] : undefined;
      if (!p) return `${pageHeader("Program not found", { back: "#/programs" })}${emptyState("That program doesn't exist.", "", '<a class="btn btn--primary" href="#/programs">Programs</a>')}`;
      draft = draftFrom(p, p.id);
    } else if (mode === "new" && id === "template") {
      draft = draftFrom(pplTemplate(), null);
    } else {
      draft = blankDraft();
    }
  }
  const d = draft;
  const names = knownExercises(builtinExercises());
  const editing = !!d.id;
  const days = d.repeats == null ? null : d.pattern.length * d.repeats;

  const workoutCards = d.workouts.map((w, wi) => `
    <section class="card builder-workout">
      <div class="builder-workout__head">
        <div class="field">
          <label for="bw-${wi}">Workout ${wi + 1} name</label>
          <input id="bw-${wi}" class="input" maxlength="40" value="${esc(w.name)}" data-b="wname" data-w="${wi}" placeholder="e.g. Push">
        </div>
        ${d.workouts.length > 1 ? `<button type="button" class="icon-btn" data-action="b-remove-workout" data-w="${wi}" aria-label="Remove ${esc(w.name || `workout ${wi + 1}`)}">${ICON.close}</button>` : ""}
      </div>
      <div class="builder-ex__head" aria-hidden="true"><span>Exercise</span><span>Sets</span><span>Reps</span><span></span></div>
      ${w.exercises.map((e, ei) => `
        <div class="builder-ex">
          <input class="input" list="b-ex-list" maxlength="60" value="${esc(e.name)}" data-b="exname" data-w="${wi}" data-e="${ei}" aria-label="Exercise ${ei + 1} name" placeholder="Exercise">
          <label class="bnum"><span aria-hidden="true">Sets</span><input class="input" inputmode="numeric" value="${e.sets}" data-b="sets" data-w="${wi}" data-e="${ei}" aria-label="${esc(e.name || `Exercise ${ei + 1}`)} sets"></label>
          <label class="bnum"><span aria-hidden="true">Reps</span><input class="input" inputmode="numeric" value="${e.reps ?? ""}" placeholder="F" data-b="reps" data-w="${wi}" data-e="${ei}" aria-label="${esc(e.name || `Exercise ${ei + 1}`)} target reps (blank = to failure)"></label>
          <button type="button" class="icon-btn" data-action="b-remove-ex" data-w="${wi}" data-e="${ei}" aria-label="Remove exercise">${ICON.close}</button>
        </div>`).join("")}
      <button type="button" class="link-btn" data-action="b-add-ex" data-w="${wi}">${ICON.plus}<span>Add exercise</span></button>
    </section>`).join("");

  const patternRows = d.pattern.map((k, i) => `
    <li class="builder-day">
      <span class="builder-day__n">Day ${i + 1}</span>
      <select class="input" data-b="pattern" data-i="${i}" aria-label="Day ${i + 1}">
        ${d.workouts.map((w) => `<option value="${w.key}" ${k === w.key ? "selected" : ""}>${esc(w.name || "Untitled workout")}</option>`).join("")}
        <option value="" ${k == null ? "selected" : ""}>Rest</option>
      </select>
      <button type="button" class="icon-btn" data-action="b-day-up" data-i="${i}" aria-label="Move day ${i + 1} earlier" ${i === 0 ? "disabled" : ""}>${ICON.chevronUp}</button>
      <button type="button" class="icon-btn" data-action="b-remove-day" data-i="${i}" aria-label="Remove day ${i + 1}" ${d.pattern.length <= 1 ? "disabled" : ""}>${ICON.close}</button>
    </li>`).join("");

  return `
    ${pageHeader(editing ? "Edit program" : "New program", { back: "#/programs", backLabel: "Programs", sub: mode === "new" && id === "template" ? "Template with common exercises and rep targets (general guidance, not from the PDF). Change anything." : "" })}
    <datalist id="b-ex-list">${names.map((e) => `<option value="${esc(e.name)}">`).join("")}</datalist>
    <section class="card form">
      <div class="field">
        <label for="b-name">Program name</label>
        <input id="b-name" class="input" maxlength="80" value="${esc(d.name)}" data-b="name" placeholder="e.g. PPL + Upper / Lower">
      </div>
    </section>

    <h2 class="section__title section__title--spaced">Workouts</h2>
    <div class="builder-workouts">${workoutCards}</div>
    <button type="button" class="btn btn--ghost btn--block section" data-action="b-add-workout">${ICON.plus}<span>Add workout</span></button>

    <h2 class="section__title section__title--spaced">Day pattern <span class="section__hint">repeats in this order</span></h2>
    <ol class="card builder-days">${patternRows}</ol>
    <div class="btn-row section">
      <button type="button" class="btn btn--ghost btn--sm" data-action="b-add-day" data-kind="workout">${ICON.plus}<span>Add workout day</span></button>
      <button type="button" class="btn btn--ghost btn--sm" data-action="b-add-day" data-kind="rest">${ICON.plus}<span>Add rest day</span></button>
    </div>

    <h2 class="section__title section__title--spaced">Length</h2>
    <section class="card form">
      <fieldset class="field">
        <legend>How long</legend>
        <label class="radio-row"><input type="radio" name="b-len" value="repeat" data-b="lenmode" ${d.repeats != null ? "checked" : ""}>
          <span>Repeat the pattern <input class="input input--inline" inputmode="numeric" value="${d.repeatsValue}" data-b="repeats" aria-label="Number of repeats"> times</span></label>
        <label class="radio-row"><input type="radio" name="b-len" value="open" data-b="lenmode" ${d.repeats == null ? "checked" : ""}><span>Until I stop it</span></label>
        <p class="field__help" id="b-len-help">${days ? `${plural(days, "day")} in total${d.pattern.length === 7 ? ` (${d.repeats} weeks)` : ""}.` : "Runs until you end it."}</p>
      </fieldset>
    </section>

    <p class="field__err section" id="b-err" role="alert" hidden></p>
    <div class="btn-row section builder-save">
      <button class="btn btn--primary btn--lg" data-action="b-save">${editing ? "Save changes" : "Save program"}</button>
      ${editing ? `<button class="btn btn--danger-ghost" data-action="b-delete">Delete program</button>` : ""}
    </div>
    ${editing && activeRun()?.programRef === programRef(d.id!) ? `<p class="fineprint">This program is running. Changes apply to days you haven't done yet; logged workouts keep what you did.</p>` : ""}`;
}

/** Input inside the builder: update the draft in place (no re-render). */
export function builderInput(el: HTMLInputElement | HTMLSelectElement) {
  if (!draft) return;
  const b = el.dataset.b;
  const wi = Number(el.dataset.w), ei = Number(el.dataset.e);
  const ex = draft.workouts[wi]?.exercises[ei];
  if (b === "name") draft.name = el.value;
  else if (b === "wname" && draft.workouts[wi]) draft.workouts[wi]!.name = el.value;
  else if (b === "exname" && ex) { ex.name = el.value; delete ex.code; }
  else if (b === "sets" && ex) ex.sets = Number(el.value);
  else if (b === "reps" && ex) ex.reps = el.value.trim() === "" ? null : Number(el.value);
  else if (b === "pattern") draft.pattern[Number(el.dataset.i)] = el.value || null;
  else if (b === "repeats") { draft.repeatsValue = Number(el.value); if (draft.repeats != null) draft.repeats = draft.repeatsValue; }
  else if (b === "lenmode") draft.repeats = el.value === "open" ? null : draft.repeatsValue || 8;
}

/** Structural builder actions. Returns true when the view should re-render. */
export function builderAction(action: string, el: HTMLElement): boolean {
  if (!draft) return false;
  const wi = Number(el.dataset.w), ei = Number(el.dataset.e), i = Number(el.dataset.i);
  switch (action) {
    case "b-add-workout": {
      const key = newKey();
      draft.workouts.push({ key, name: `Workout ${String.fromCharCode(65 + draft.workouts.length)}`, exercises: [{ name: "", sets: 3, reps: 10 }] });
      return true;
    }
    case "b-remove-workout": {
      const key = draft.workouts[wi]?.key;
      draft.workouts.splice(wi, 1);
      draft.pattern = draft.pattern.map((k) => (k === key ? null : k));
      return true;
    }
    case "b-add-ex": draft.workouts[wi]?.exercises.push({ name: "", sets: 3, reps: 10 }); return true;
    case "b-remove-ex": draft.workouts[wi]?.exercises.splice(ei, 1); return true;
    case "b-add-day": draft.pattern.push(el.dataset.kind === "rest" ? null : draft.workouts[0]?.key ?? null); return true;
    case "b-remove-day": if (draft.pattern.length > 1) draft.pattern.splice(i, 1); return true;
    case "b-day-up": if (i > 0) [draft.pattern[i - 1], draft.pattern[i]] = [draft.pattern[i]!, draft.pattern[i - 1]!]; return true;
  }
  return false;
}

/** Validate and save. Returns { error } or { id, isNew }. */
export function builderSave(): { error: string } | { id: string; isNew: boolean } {
  if (!draft) return { error: "Nothing to save." };
  const d = draft;
  const name = d.name.trim();
  if (!name) return { error: "Give your program a name." };
  if (!d.workouts.length) return { error: "Add at least one workout." };
  const known = knownExercises(builtinExercises());
  const workouts = [];
  for (const [wi, w] of d.workouts.entries()) {
    const wname = w.name.trim() || `Workout ${wi + 1}`;
    const exs = w.exercises.filter((e) => e.name.trim());
    if (!exs.length) return { error: `“${wname}” needs at least one exercise.` };
    const seen = new Set<string>();
    const exercises = [];
    for (const e of exs) {
      if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 10) return { error: `Sets for “${e.name}” must be 1–10.` };
      if (e.reps != null && (!Number.isInteger(e.reps) || e.reps < 1 || e.reps > 100)) return { error: `Reps for “${e.name}” must be 1–100, or blank for “to failure”.` };
      const code = e.code ?? codeForName(e.name, known);
      if (seen.has(code)) return { error: `“${e.name}” is listed twice in ${wname}.` };
      seen.add(code);
      exercises.push({ code, name: known.find((k) => k.code === code)?.name ?? e.name.trim(), sets: e.sets, reps: e.reps });
    }
    workouts.push({ key: w.key, name: wname, short: shortFor(wname), exercises });
  }
  if (!d.pattern.some((k) => k != null)) return { error: "The day pattern needs at least one workout day." };
  if (d.repeats != null && (!Number.isInteger(d.repeats) || d.repeats < 1 || d.repeats > 52)) return { error: "Repeats must be a whole number from 1 to 52." };

  const now = new Date().toISOString();
  const id = d.id ?? uuid();
  const prev = store.state.programs[id];
  store.state.programs[id] = { id, name, workouts, pattern: d.pattern, repeats: d.repeats, createdAt: prev?.createdAt ?? now, updatedAt: now };
  changed(`program:${id}`);
  draft = null;
  return { id, isNew: !d.id };
}

export function builderDeleteTarget(): string | null { return draft?.id ?? null; }
export function discardDraft() { draft = null; }
