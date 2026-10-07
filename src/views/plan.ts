/* The active program's plan, shown on the Progress tab: cycles (or weeks) of day tiles. */
import { customIdOf } from "../data/programs";
import { CYCLE_LENGTH } from "../data/workout-data";
import { dayTile, finishLine } from "../components/day-card";
import { currentDay, dayStatus, isBuiltin, planDate, projection, runLength, store, type Run } from "../lib/state";
import { esc, fmtDate } from "../lib/utils";

let selectedCycle: number | null = null;
export const selectCycle = (c: number | null) => { selectedCycle = c; };

/** Days per cycle tab: 12 for 60 Days to Fit, the pattern length for custom programs. */
function cycleSize(run: Run): number {
  if (isBuiltin(run)) return CYCLE_LENGTH;
  return store.state.programs[customIdOf(run.programRef) ?? ""]?.pattern.length || 7;
}

export function renderPlanSection(run: Run): string {
  const size = cycleSize(run);
  const len = runLength(run);
  const p = projection(run);
  const cur = Math.max(currentDay() ?? 1, 1);
  const total = len ?? Math.max(...Object.keys(p.dates).map(Number), cur) ;
  const cycles = Math.max(1, Math.ceil(total / size));
  const unitName = isBuiltin(run) ? "Cycle" : size === 7 ? "Week" : "Round";
  const cyc = Math.min((selectedCycle ??= Math.ceil(Math.min(cur, total) / size)), cycles);
  const first = (cyc - 1) * size + 1;
  const last = Math.min(cyc * size, total);

  const journey: string[] = [];
  if (len) for (let d = 1; d <= len; d++) journey.push(`<span class="journey__seg is-${dayStatus(run, d)}"></span>`);

  const tabs: string[] = [];
  for (let c = 1; c <= cycles; c++) {
    let n = 0, cnt = 0;
    for (let d = (c - 1) * size + 1; d <= Math.min(c * size, total); d++) { cnt++; if (run.days[d]) n++; }
    tabs.push(`<button class="cycle-tab ${c === cyc ? "is-active" : ""}" role="tab" aria-selected="${c === cyc}" aria-controls="cycle-panel"
      id="cycle-tab-${c}" tabindex="${c === cyc ? 0 : -1}" data-action="cycle" data-cycle="${c}" aria-label="${unitName} ${c}, ${n} of ${cnt} done">
      <span class="cycle-tab__n">${c}</span><span class="cycle-tab__meta">${n === cnt ? "✓" : `${n}/${cnt}`}</span></button>`);
  }

  const tiles: string[] = [];
  for (let d = first; d <= last; d++) tiles.push(dayTile(run, d));

  return `
    <section class="section" id="plan">
      <h2 class="section__title">${esc(run.name)} plan <span class="section__hint">${esc(finishLine(run))}</span></h2>
      ${journey.length ? `<div class="journey ${len && len > 60 ? "journey--dense" : ""}" aria-hidden="true">${journey.join("")}</div>` : ""}
      <div class="cycle-tabs ${cycles > 6 ? "cycle-tabs--scroll" : ""}" role="tablist" aria-label="${unitName}s" data-cycles="${cycles}">${tabs.join("")}</div>
      <div id="cycle-panel" class="cycle" role="tabpanel" aria-labelledby="cycle-tab-${cyc}">
        <div class="cycle__head">
          <h3 class="section__title">${unitName} ${cyc}</h3>
          <p class="muted">Days ${first}–${last} · ${esc(fmtDate(planDate(run, first), { day: "numeric", month: "short" }))} – ${esc(fmtDate(planDate(run, last), { day: "numeric", month: "short" }))}</p>
        </div>
        <ol class="day-grid ${size === 7 ? "day-grid--week" : ""}">${tiles.join("")}</ol>
      </div>
      <ul class="legend" aria-label="Legend">
        <li><span class="legend__sw is-current"></span>Next up</li>
        <li><span class="legend__sw is-completed"></span>Done</li>
        <li><span class="legend__sw is-skipped"></span>Skipped</li>
        <li><span class="legend__sw is-rest"></span>Rest</li>
      </ul>
      <p class="fineprint">Done days show the date you did them; the rest show when they're planned if you train every planned day. Taking a day off moves the rest back.</p>
    </section>`;
}
