import { renderPlanSection } from "./plan";
import { emptyState, pageHeader } from "../components/ui";
import {
  activeRun, currentDay, fmtSet, fmtW, kgToDisplay, personalBests, projection, resolvedCount, runLength, runProgramName, runSlot,
  sessionsSorted, sortedWeights, unit, type BodyWeightEntry, type Run,
} from "../lib/state";
import { addDays, esc, fmtDate, parseISO, plural, round2, todayISO } from "../lib/utils";

export function renderProgress(): string {
  const run = activeRun();
  return `
    ${pageHeader("Progress")}
    ${run ? programProgress(run) : `<section class="card day-detail"><p class="day-detail__title">No program running</p>
      <p class="muted">Your training history below still counts.</p><a class="btn btn--primary btn--block" href="#/programs">Choose a program</a></section>`}
    ${activitySection()}
    ${bestsSection()}
    ${bodyWeightSummary()}`;
}

function programProgress(run: Run): string {
  const len = runLength(run);
  const done = resolvedCount(run, "done");
  const skipped = resolvedCount(run, "skipped");
  let wDone = 0, rDone = 0, wTotal = 0, rTotal = 0;
  for (const [n, d] of Object.entries(run.days)) {
    if (d.status !== "done") continue;
    runSlot(run, Number(n))?.type === "rest" ? rDone++ : wDone++;
  }
  if (len) for (let d = 1; d <= len; d++) runSlot(run, d)?.type === "rest" ? rTotal++ : wTotal++;
  const cur = currentDay() ?? 0;
  const resolved = done + skipped;
  const pct = len ? Math.round((resolved / len) * 100) : 0;
  const message = resolved === 0 ? "Day 1 is where it starts" : run.status === "finished" ? "Program complete" : pct >= 50 ? "Over halfway. Keep going" : "Keep going";

  const R = 52, C = 2 * Math.PI * R;
  const ring = len ? `<svg class="prog-ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="prog-ring__track" cx="60" cy="60" r="${R}"/>
      <circle class="prog-ring__fill" cx="60" cy="60" r="${R}" stroke-dasharray="${C}" style="--off:${C * (1 - resolved / len)};--full:${C}"/>
    </svg>` : "";
  const p = projection(run);

  return `
    <section class="progress-hero card">
      ${len ? `<div class="ring-wrap">${ring}<div class="prog-ring__center"><strong>${pct}%</strong><span>complete</span></div></div>` : ""}
      <div class="progress-hero__text">
        <p class="eyebrow"><a href="#/programs">${esc(runProgramName(run))}</a></p>
        <p class="progress-hero__big">${resolved}<span>${len ? `/${len}` : ""} days</span></p>
        <p class="progress-hero__msg">${message}</p>
      </div>
    </section>
    <section class="stats">
      <div class="stat card"><span class="stat__label">Workouts</span><span class="stat__value">${wDone}${len ? `<small>/${wTotal}</small>` : ""}</span></div>
      <div class="stat card"><span class="stat__label">Rest days</span><span class="stat__value">${rDone}${len ? `<small>/${rTotal}</small>` : ""}</span>
        ${skipped ? `<span class="stat__foot">${skipped} skipped to train</span>` : ""}</div>
      <div class="stat card"><span class="stat__label">Next up</span><span class="stat__value">${cur >= 1 && (!len || cur <= len) ? `Day ${cur}` : "—"}</span></div>
      <div class="stat card"><span class="stat__label">Finish</span><span class="stat__value stat__value--sm">${p.finish ? esc(fmtDate(p.finish, { day: "numeric", month: "short" })) : "Open"}</span>
        <span class="stat__foot">${p.finish ? (p.slip > 0 ? `${plural(p.slip, "day")} later than planned` : "On schedule") : "Runs until you stop"}</span></div>
    </section>
    ${renderPlanSection(run)}`;
}

/** Training days in the last 4 weeks, across every program and free workouts. */
function activitySection(): string {
  const today = todayISO();
  const from = addDays(today, -27);
  const trained = new Set(sessionsSorted().filter((s) => s.status === "done" && s.date >= from).map((s) => s.date));
  const cells: string[] = [];
  for (let i = 0; i < 28; i++) {
    const d = addDays(from, i);
    cells.push(`<span class="act__cell ${trained.has(d) ? "is-on" : ""} ${d === today ? "is-today" : ""}" title="${esc(fmtDate(d))}"></span>`);
  }
  const total = sessionsSorted().filter((s) => s.status === "done").length;
  return `<section class="section">
    <h2 class="section__title">Last 4 weeks <span class="section__hint">${plural(trained.size, "training day")} · ${plural(total, "workout")} all time</span></h2>
    <div class="card act" role="img" aria-label="${trained.size} training days in the last 4 weeks">${cells.join("")}</div>
  </section>`;
}

function bestsSection() {
  const list = personalBests();
  if (!list.length) {
    return `<section class="section"><h2 class="section__title">Personal bests</h2>
      ${emptyState("No workout history yet.", "Your heaviest logged set for each exercise will appear here.")}</section>`;
  }
  return `<section class="section">
    <h2 class="section__title">Personal bests <span class="section__hint">across all programs</span></h2>
    <ul class="card list-rows">
      ${list.slice(0, 8).map((b) => `<li class="list-row">
        <span class="list-row__main">${esc(b.name)}<small>${esc(fmtDate(b.date))}</small></span>
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
