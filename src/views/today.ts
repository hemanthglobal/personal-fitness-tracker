import { routineMinutes, WARMUPS } from "../data/routines";
import type { Slot } from "../data/programs";
import { INTENSITY } from "../data/workout-data";
import { finishLine, relDate, restHero, upcomingList } from "../components/day-card";
import { ICON } from "../components/icons";
import { emptyState, pageHeader, pill, progressBar } from "../components/ui";
import {
  activeRun, currentDay, findPrevious, fmtSet, planDate, projection, resolvedCount, runLength, runProgramName, runSlot,
  sessionForDay, sessionProgress, sessionsOn, store, type Run, type SetLog,
} from "../lib/state";
import { esc, fmtDate, fmtLongDate, plural, todayISO } from "../lib/utils";

const freeButton = (cls = "btn--ghost") => `<button class="btn ${cls} btn--block" data-action="free-workout">${ICON.plus}<span>Log a free workout</span></button>`;

export function renderToday(): string {
  const run = activeRun();
  const today = todayISO();
  const todays = sessionsOn(today);

  if (!run) {
    const last = Object.values(store.state.runs).sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))[0];
    return `
      ${pageHeader("No program running", { eyebrow: esc(fmtDate(today, { weekday: "long", day: "numeric", month: "long" })) })}
      <section class="hero">
        <p class="hero__eyebrow">${last ? `Last: ${esc(last.name)}` : "Get started"}</p>
        <p class="hero__title">Pick your next program</p>
        <p class="hero__meta">Run 60 Days to Fit, use the Push/Pull/Legs template, or build your own.</p>
        <a class="btn btn--primary btn--lg btn--block" href="#/programs">Choose a program</a>
      </section>
      ${todayDone(todays, null)}
      <div class="section">${freeButton()}</div>`;
  }

  if (run.status === "finished") {
    return `
      ${pageHeader("Program complete", { eyebrow: esc(runProgramName(run)) })}
      <section class="hero is-complete">
        <p class="hero__eyebrow">You finished ${esc(runProgramName(run))}</p>
        <p class="hero__title">${resolvedCount(run, "done")}<span class="hero__of">/${runLength(run)}</span></p>
        <p class="hero__meta">days done</p>
        <div class="stack-sm">
          <a class="btn btn--primary btn--lg btn--block" href="#/programs">Start another program</a>
          <a class="btn btn--on-dark btn--block" href="#/progress">View your progress</a>
        </div>
      </section>
      <div class="section">${freeButton()}</div>`;
  }

  const day = currentDay()!;
  if (day < 1) {
    const n = 1 - day;
    return `
      ${pageHeader("You're all set.", { eyebrow: esc(runProgramName(run)) })}
      <section class="hero">
        <p class="hero__eyebrow">Your program starts on</p>
        <p class="hero__title hero__title--date">${esc(fmtLongDate(run.startDate))}</p>
        <p class="hero__meta">${n === 1 ? "Tomorrow" : `In ${n} days`}</p>
        <a class="btn btn--primary btn--lg btn--block" href="#/day/1">View Day 1</a>
      </section>
      ${upcomingList(run, 1, 3)}
      <div class="section">${freeButton()}</div>`;
  }

  const slot = runSlot(run, day)!;
  const planned = planDate(run, day);
  const later = planned !== today; // already trained today → next one is planned for tomorrow
  const len = runLength(run);
  const head = `
    <header class="today-head">
      <div>
        <p class="eyebrow">${esc(fmtDate(today, { weekday: "long", day: "numeric", month: "long" }))}</p>
        <h1 class="today-head__day">Day ${day}<span class="today-head__of">${len ? ` / ${len}` : ""}</span></h1>
      </div>
      <a class="today-head__cycle" href="#/programs" aria-label="Program: ${esc(runProgramName(run))}">
        <span>${slot.type === "workout" && slot.cycle ? "Cycle" : "Program"}</span>
        <strong>${slot.type === "workout" && slot.cycle ? `${slot.cycle}<small>/5</small>` : esc(shortProgram(run))}</strong>
      </a>
    </header>`;

  const p = projection(run);
  const slipNote = p.slip > 0
    ? `<a class="notice" href="#/calendar">${ICON.info}<span>${esc(finishLine(run))}. Your plan picks up wherever you left off.</span>${ICON.chevron}</a>`
    : "";
  const whenLabel = later ? ` · up next ${relDate(planned).toLowerCase()}` : "";

  if (slot.type === "rest") {
    return `${head}${todayDone(todays, run)}${restHero(run, day, `Recovery${whenLabel}`, "Rest day")}${slipNote}
      ${upcomingList(run, day + 1, 3)}<div class="section">${freeButton()}</div>`;
  }

  const session = sessionForDay(run, day);
  const prog = sessionProgress(session?.plan.length ? session.plan : slot.exercises, session);
  const started = prog.setsDone > 0;
  const I = slot.intensity ? INTENSITY[slot.intensity] : null;

  return `
    ${head}
    ${todayDone(todays, run)}
    <section class="hero">
      <div class="hero__row"><p class="hero__eyebrow">${slot.letter ? `Workout ${slot.letter}` : esc(runProgramName(run))}${whenLabel}</p>${slot.intensity ? pill(slot.intensity) : ""}</div>
      <p class="hero__title">${esc(slot.name)}</p>
      <p class="hero__meta">${plural(slot.exercises.length, "exercise")}${I ? ` · ${I.tempo.toLowerCase()} · ${I.rest}` : ""}</p>
      ${started ? `<div class="hero__progress">${progressBar(prog.setsDone, prog.setsTotal, "Sets done")}<span>${prog.setsDone}/${prog.setsTotal} sets</span></div>` : ""}
      <a class="btn btn--primary btn--lg btn--block" href="#/day/${day}">${started ? "Continue workout" : "Start workout"}</a>
      <div class="hero__links">
        <a class="hero__link" href="#/session/warmup/${slot.letter ?? "full"}/${day}">${ICON.play}<span>Warm up · ${routineMinutes(WARMUPS[slot.letter ?? "full"])} min</span></a>
        <a class="hero__link" href="#/swap">${ICON.refresh}<span>Swap workout</span></a>
      </div>
    </section>
    ${slipNote}
    ${lastTimeCard(slot)}
    ${upcomingList(run, day + 1, 3)}
    <div class="section">${freeButton()}</div>`;
}

function shortProgram(run: Run) {
  const name = runProgramName(run);
  return name.length <= 6 ? name : name.split(/[\s/+]+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).join("").slice(0, 4);
}

/** What's already been done today (any program, swaps, free workouts, rested). */
function todayDone(todays: ReturnType<typeof sessionsOn>, run: Run | null) {
  const items = todays.filter((s) => s.status === "done").map((s) => `<a href="#/log/${s.id}">${esc(s.title)}</a>`);
  if (run) {
    for (const [n, d] of Object.entries(run.days)) {
      if (d.date === todayISO() && !d.sessionId) items.push(d.status === "done" ? `Rest day ${n}` : `skipped rest day ${n}`);
    }
  }
  const inProgress = todays.filter((s) => s.status === "in_progress" && s.runId == null);
  if (!items.length && !inProgress.length) return "";
  return `<div class="notice notice--ok">${ICON.check}<span>${items.length ? `Done today: ${items.join(", ")}.` : ""}
    ${inProgress.map((s) => `<a href="#/log/${s.id}">Continue ${esc(s.title.toLowerCase())}</a>`).join(" ")}</span></div>`;
}

/** Last session of the same workout vs today's targets. No invented weight suggestions. */
function lastTimeCard(slot: Extract<Slot, { type: "workout" }>) {
  const rows = slot.exercises.map((ex) => {
    const prev = findPrevious(null, ex.code, slot.key);
    let best: SetLog | null = null;
    if (prev && prev.session.workoutKey === slot.key) {
      best = prev.sets.reduce((a, s) => ((s.weight ?? 0) > (a.weight ?? 0) || (s.weight === a.weight && (s.reps ?? 0) > (a.reps ?? 0)) ? s : a));
    }
    return { ex, best };
  });
  if (!rows.some((r) => r.best)) {
    return `<section class="section"><h2 class="section__title">Last time</h2>
      ${emptyState("No history for this workout yet.", "Your first session sets the baseline. Next time, your numbers show up here.")}</section>`;
  }
  return `<section class="section">
    <h2 class="section__title">Last time <span class="section__hint">vs target today</span></h2>
    <ul class="card list-rows">
      ${rows.map((r) => `<li class="list-row">
        <span class="list-row__main">${esc(r.ex.name)}</span>
        <span class="list-row__value">${r.best ? esc(fmtSet(r.best)) : '<span class="muted">—</span>'}</span>
        <span class="list-row__target">${r.ex.reps == null ? "failure" : `× ${r.ex.reps}`}</span>
      </li>`).join("")}
    </ul>
  </section>`;
}
