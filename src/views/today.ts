import { getSchedule, getTargetReps, INTENSITY, TOTAL_DAYS } from "../data/workout-data";
import type { WorkoutSchedule } from "../types/workout";
import { restHero, upcomingList } from "../components/day-card";
import { ICON } from "../components/icons";
import { emptyState, pageHeader, pill, progressBar } from "../components/ui";
import { completedCount, currentDay, dayStatus, findPrevious, fmtSet, isDayComplete, store, workoutProgress, type SetLog } from "../lib/state";
import { esc, fmtDate, fmtLongDate, plural, todayISO } from "../lib/utils";

export function renderToday(): string {
  const day = currentDay();
  const start = store.state.settings.startDate;

  if (day < 1) {
    const n = 1 - day;
    return `
      ${pageHeader("You're all set.", { eyebrow: "Not started yet" })}
      <section class="hero">
        <p class="hero__eyebrow">Your 60-day programme starts on</p>
        <p class="hero__title hero__title--date">${esc(fmtLongDate(start))}</p>
        <p class="hero__meta">${n === 1 ? "Tomorrow" : `In ${n} days`}</p>
        <a class="btn btn--primary btn--lg btn--block" href="#/day/1">View Day 1</a>
      </section>
      ${upcomingList(1, 3)}`;
  }

  if (day > TOTAL_DAYS) {
    return `
      ${pageHeader("60 days complete", { eyebrow: "Programme finished" })}
      <section class="hero">
        <p class="hero__eyebrow">You finished the programme</p>
        <p class="hero__title">${completedCount()}<span class="hero__of">/60</span></p>
        <p class="hero__meta">days checked off</p>
        <div class="stack-sm">
          <a class="btn btn--primary btn--lg btn--block" href="#/progress">View your progress</a>
          <button class="btn btn--on-dark btn--block" data-action="start-again">Start again</button>
        </div>
      </section>`;
  }

  const sched = getSchedule(day)!;
  const done = isDayComplete(day);
  const missed: number[] = [];
  for (let d = 1; d < day; d++) if (dayStatus(d) === "missed") missed.push(d);

  const head = `
    <header class="today-head">
      <div>
        <p class="eyebrow">${esc(fmtDate(todayISO(), { weekday: "long", day: "numeric", month: "long" }))}</p>
        <h1 class="today-head__day">Day ${day}<span class="today-head__of"> / 60</span></h1>
      </div>
      <div class="today-head__cycle"><span>Cycle</span><strong>${sched.cycle}<small>/5</small></strong></div>
    </header>`;

  const missedNote = missed.length
    ? `<a class="notice notice--warn" href="#/calendar">${ICON.alert}<span>${plural(missed.length, "earlier workout")} not checked off. Review in calendar</span>${ICON.chevron}</a>`
    : "";

  if (sched.type === "rest") {
    return `${head}${restHero(day, "Recovery", "Rest day")}${missedNote}${upcomingList(day + 1, 3)}`;
  }

  const prog = workoutProgress(sched);
  const started = prog.setsDone > 0;
  const I = INTENSITY[sched.intensity];
  const cta = done
    ? `<a class="btn btn--on-dark btn--lg btn--block" href="#/day/${day}">${ICON.check}<span>Completed · view or edit</span></a>`
    : `<a class="btn btn--primary btn--lg btn--block" href="#/day/${day}">${started ? "Continue workout" : "Start workout"}</a>`;

  return `
    ${head}
    <section class="hero ${done ? "is-complete" : ""}">
      <div class="hero__row"><p class="hero__eyebrow">Workout ${sched.workout}</p>${pill(sched.intensity)}</div>
      <p class="hero__title">${esc(sched.name)}</p>
      <p class="hero__meta">${plural(sched.exercises.length, "exercise")} · ${I.tempo.toLowerCase()} · ${I.rest}</p>
      ${started && !done ? `<div class="hero__progress">${progressBar(prog.setsDone, prog.setsTotal, "Sets done today")}<span>${prog.setsDone}/${prog.setsTotal} sets</span></div>` : ""}
      ${cta}
    </section>
    ${missedNote}
    ${lastTimeCard(sched)}
    ${upcomingList(day + 1, 3)}`;
}

/** Previous session of the same workout + intensity vs today's rep target. No invented weight suggestions. */
function lastTimeCard(sched: WorkoutSchedule) {
  const rows = sched.exercises.map((ex) => {
    const prev = findPrevious(sched.day, ex.code, sched.intensity);
    let best: SetLog | null = null;
    if (prev && prev.intensity === sched.intensity) {
      best = prev.sets.reduce((a, s) =>
        (s.weight ?? 0) > (a.weight ?? 0) || (s.weight === a.weight && (s.reps ?? 0) > (a.reps ?? 0)) ? s : a);
    }
    return { ex, best, target: getTargetReps(sched.intensity, sched.cycle, ex) };
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
        <span class="list-row__target">${r.target == null ? "failure" : `× ${r.target}`}</span>
      </li>`).join("")}
    </ul>
  </section>`;
}
