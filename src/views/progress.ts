import { CYCLE_LENGTH, CYCLES, exerciseName, getSchedule, TOTAL_DAYS } from "../data/workout-data";
import { emptyState, pageHeader, progressBar } from "../components/ui";
import {
  currentDay, cycleOf, fmtSet, fmtW, isDayComplete, kgToDisplay, loggedSets, personalBests, programmeTotals, sortedWeights, store, unit,
  type BodyWeightEntry,
} from "../lib/state";
import { esc, fmtDate, parseISO, plural, round2 } from "../lib/utils";

export function renderProgress(): string {
  const today = currentDay();
  const totals = programmeTotals();
  let wDone = 0, rDone = 0;
  for (let d = 1; d <= TOTAL_DAYS; d++) {
    if (!isDayComplete(d)) continue;
    getSchedule(d)!.type === "rest" ? rDone++ : wDone++;
  }
  const doneDays = wDone + rDone;
  const pct = Math.round((doneDays / TOTAL_DAYS) * 100);
  const elapsed = Math.min(Math.max(today, 0), TOTAL_DAYS);
  let doneSoFar = 0;
  for (let d = 1; d <= elapsed; d++) if (isDayComplete(d)) doneSoFar++;
  const consistency = elapsed ? Math.round((doneSoFar / elapsed) * 100) : 0;
  const cycle = today < 1 ? 1 : cycleOf(today);
  const message = doneDays === 0 ? "Day 1 is where it starts" : doneDays >= TOTAL_DAYS ? "Programme complete" : pct >= 50 ? "Over halfway. Keep going" : "Keep going";

  const R = 52, C = 2 * Math.PI * R;
  const ring = `<svg class="prog-ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="prog-ring__track" cx="60" cy="60" r="${R}"/>
      <circle class="prog-ring__fill" cx="60" cy="60" r="${R}" stroke-dasharray="${C}" style="--off:${C * (1 - doneDays / TOTAL_DAYS)};--full:${C}"/>
    </svg>`;

  const bars: string[] = [];
  for (let c = 1; c <= CYCLES; c++) {
    let n = 0;
    for (let d = (c - 1) * CYCLE_LENGTH + 1; d <= c * CYCLE_LENGTH; d++) if (isDayComplete(d)) n++;
    const current = c === cycle && today >= 1 && today <= TOTAL_DAYS;
    bars.push(`<li class="cycle-bar ${current ? "is-current" : ""}"><span class="cycle-bar__label">Cycle ${c}${current ? '<span class="sr-only"> (current)</span>' : ""}</span>
      ${progressBar(n, CYCLE_LENGTH, `Cycle ${c} progress`)}<span class="cycle-bar__n">${n}/12</span></li>`);
  }

  return `
    ${pageHeader("Progress")}
    <section class="progress-hero card">
      <div class="ring-wrap">${ring}<div class="prog-ring__center"><strong>${pct}%</strong><span>complete</span></div></div>
      <div class="progress-hero__text">
        <p class="eyebrow">${today < 1 ? "Not started" : today > TOTAL_DAYS ? "Finished" : `Day ${today} of 60`}</p>
        <p class="progress-hero__big">${doneDays}<span>/60 days</span></p>
        <p class="progress-hero__msg">${message}</p>
      </div>
    </section>
    <section class="stats">
      <div class="stat card"><span class="stat__label">Workouts</span><span class="stat__value">${wDone}<small>/${totals.workouts}</small></span></div>
      <div class="stat card"><span class="stat__label">Rest days</span><span class="stat__value">${rDone}<small>/${totals.rest}</small></span></div>
      <div class="stat card"><span class="stat__label">Current cycle</span><span class="stat__value">${cycle}<small>/5</small></span></div>
      <div class="stat card"><span class="stat__label">Consistency</span><span class="stat__value">${elapsed ? `${consistency}<small>%</small>` : "—"}</span>
        <span class="stat__foot">${elapsed ? `${doneSoFar} of ${elapsed} days so far` : "Starts on Day 1"}</span></div>
    </section>
    <section class="section">
      <h2 class="section__title">Cycles</h2>
      <ul class="card cycle-bars">${bars.join("")}</ul>
    </section>
    ${bestsSection()}
    ${bodyWeightSummary()}`;
}

function bestsSection() {
  const list = personalBests();
  const sessions = Object.values(store.state.workouts).filter((exs) => Object.values(exs).some((l) => loggedSets(l).length)).length;
  if (!list.length) {
    return `<section class="section"><h2 class="section__title">Personal bests</h2>
      ${emptyState("No workout history yet.", "Your heaviest logged set for each exercise will appear here.")}</section>`;
  }
  return `<section class="section">
    <h2 class="section__title">Personal bests <span class="section__hint">${plural(sessions, "session")} logged</span></h2>
    <ul class="card list-rows">
      ${list.slice(0, 8).map((b) => `<li class="list-row">
        <span class="list-row__main">${esc(exerciseName(b.code))}<small>Day ${b.day}</small></span>
        <span class="list-row__value">${esc(fmtSet(b))}</span></li>`).join("")}
    </ul>
  </section>`;
}

function bodyWeightSummary() {
  const w = sortedWeights();
  if (!w.length) {
    return `<section class="section"><h2 class="section__title">Body weight</h2>
      ${emptyState("No weight entries yet.", "Add your first measurement to start tracking.", '<a class="btn btn--ghost" href="#/weight">Log body weight</a>')}</section>`;
  }
  return `<section class="section">
    <h2 class="section__title">Body weight <a class="section__link" href="#/weight">Log</a></h2>
    <div class="card">${weightStats(w)}${w.length >= 2 ? weightChart(w) : ""}</div>
  </section>`;
}

export function weightStats(w: BodyWeightEntry[]) {
  const first = w[0]!, last = w[w.length - 1]!;
  const diff = kgToDisplay(last.weight) - kgToDisplay(first.weight);
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  return `<div class="wstats">
    <div><span class="stat__label">Current</span><span class="stat__value">${fmtW(last.weight)}<small> ${unit()}</small></span></div>
    <div><span class="stat__label">Starting</span><span class="stat__value">${fmtW(first.weight)}<small> ${unit()}</small></span></div>
    <div><span class="stat__label">Change</span><span class="stat__value">${sign}${round2(Math.abs(diff))}<small> ${unit()}</small></span></div>
  </div>`;
}

export function weightChart(w: BodyWeightEntry[]) {
  const W = 320, H = 120, pad = 10;
  const vals = w.map((e) => kgToDisplay(e.weight));
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const time = (e: BodyWeightEntry) => parseISO(e.date)!.getTime();
  const t0 = time(w[0]!), tspan = time(w[w.length - 1]!) - t0 || 1;
  const pts = w.map((e, i) => [
    round2(pad + ((time(e) - t0) / tspan) * (W - pad * 2)),
    round2(pad + (1 - (vals[i]! - min) / span) * (H - pad * 2)),
  ]);
  const line = pts.map((p) => p.join(",")).join(" ");
  return `<figure class="chart">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Body weight from ${vals[0]} to ${vals[vals.length - 1]} ${unit()}">
      <polygon class="chart__area" points="${pad},${H} ${line} ${W - pad},${H}"/>
      <polyline class="chart__line" points="${line}" vector-effect="non-scaling-stroke"/>
    </svg>
    <figcaption><span>${esc(fmtDate(w[0]!.date, { day: "numeric", month: "short" }))}</span><span>${min}–${max} ${unit()}</span><span>${esc(fmtDate(w[w.length - 1]!.date, { day: "numeric", month: "short" }))}</span></figcaption>
  </figure>`;
}
