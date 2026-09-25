import { CYCLE_LENGTH, CYCLES, TOTAL_DAYS } from "../data/workout-data";
import { dayTile } from "../components/day-card";
import { pageHeader } from "../components/ui";
import { completedCount, currentDay, cycleOf, dateForDay, dayStatus, isDayComplete } from "../lib/state";
import { esc, fmtDate } from "../lib/utils";

let selectedCycle: number | null = null;
export const selectCycle = (c: number | null) => { selectedCycle = c; };

export function renderCalendar(): string {
  const cyc = (selectedCycle ??= cycleOf(currentDay()));
  const first = (cyc - 1) * CYCLE_LENGTH + 1;
  const last = cyc * CYCLE_LENGTH;

  const journey: string[] = [];
  for (let d = 1; d <= TOTAL_DAYS; d++) journey.push(`<span class="journey__seg is-${dayStatus(d)}"></span>`);

  const tabs: string[] = [];
  for (let c = 1; c <= CYCLES; c++) {
    let n = 0;
    for (let d = (c - 1) * CYCLE_LENGTH + 1; d <= c * CYCLE_LENGTH; d++) if (isDayComplete(d)) n++;
    tabs.push(`<button class="cycle-tab ${c === cyc ? "is-active" : ""}" role="tab" aria-selected="${c === cyc}" aria-controls="cycle-panel"
      id="cycle-tab-${c}" tabindex="${c === cyc ? 0 : -1}" data-action="cycle" data-cycle="${c}">
      <span class="cycle-tab__n">${c}</span><span class="cycle-tab__meta">${n === CYCLE_LENGTH ? "✓ done" : `${n}/12`}</span></button>`);
  }

  const tiles: string[] = [];
  for (let d = first; d <= last; d++) tiles.push(dayTile(d));

  return `
    ${pageHeader("Calendar", { eyebrow: `${completedCount()} of 60 days complete` })}
    <div class="journey" aria-hidden="true">${journey.join("")}</div>
    <div class="cycle-tabs" role="tablist" aria-label="Cycles">${tabs.join("")}</div>
    <section id="cycle-panel" class="cycle" role="tabpanel" aria-labelledby="cycle-tab-${cyc}">
      <div class="cycle__head">
        <h2 class="section__title">Cycle ${cyc}</h2>
        <p class="muted">Days ${first}–${last} · ${esc(fmtDate(dateForDay(first), { day: "numeric", month: "short" }))} – ${esc(fmtDate(dateForDay(last), { day: "numeric", month: "short" }))}</p>
      </div>
      <ol class="day-grid">${tiles.join("")}</ol>
    </section>
    <ul class="legend" aria-label="Legend">
      <li><span class="legend__sw is-current"></span>Today</li>
      <li><span class="legend__sw is-completed"></span>Done</li>
      <li><span class="legend__sw is-missed"></span>Missed</li>
      <li><span class="legend__sw is-rest"></span>Rest</li>
    </ul>
    <p class="fineprint">Each 12-day cycle: 8 workouts and 4 rest days. Every body part is trained once light and once heavy.</p>`;
}
