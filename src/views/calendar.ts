/*
 * Calendar tab: a real month calendar that is also the training log.
 *   - Past dates show what was actually trained (any program, swaps, free workouts) and rest days.
 *   - Today and future dates show the active program's projected plan.
 * Tapping a date shows its details. The 60-day plan by cycle lives on the Progress tab.
 */
import { customIdOf, shortFor } from "../data/programs";
import { finishLine } from "../components/day-card";
import { ICON } from "../components/icons";
import { pageHeader, pill, restPill } from "../components/ui";
import { activeRun, isBuiltin, projection, runProgramName, runSlot, sessionsOn, store, type Run, type Session } from "../lib/state";
import { esc, fmtDate, fmtLongDate, parseISO, toISO, todayISO } from "../lib/utils";

let monthCursor: string | null = null;
let selected: string | null = null;
const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

export function resetCalendar() { monthCursor = null; selected = null; }

export function calendarAction(action: string, date?: string) {
  const cur = parseISO(monthCursor ?? firstOfMonth(todayISO()))!;
  if (action === "month-prev") cur.setMonth(cur.getMonth() - 1);
  if (action === "month-next") cur.setMonth(cur.getMonth() + 1);
  if (action === "month-today") { selected = todayISO(); monthCursor = firstOfMonth(selected); return; }
  if (action === "pick-date" && date) { selected = date; return; }
  monthCursor = toISO(cur);
}

/* ---------------------------------------------------------------------------
 * What happened / is planned on each date
 * ------------------------------------------------------------------------- */

type Entry =
  | { kind: "session"; session: Session; short: string }
  | { kind: "rest"; run: Run; day: number; status: "done" | "skipped" }
  | { kind: "planned"; run: Run; day: number; short: string; title: string; rest: boolean };

/** Short label for a session's workout, e.g. "AL", "Push", "Free". */
function sessionShort(s: Session): string {
  const run = s.runId ? store.state.runs[s.runId] : null;
  if (run && s.day) {
    const slot = runSlot(run, s.day);
    if (slot?.type === "workout" && slot.key === s.workoutKey) return slot.short;
  }
  if (s.workoutKey && /^[A-D]-(light|heavy)$/.test(s.workoutKey)) return `${s.workoutKey[0]}${s.workoutKey.includes("light") ? "L" : "H"}`;
  if (s.workoutKey && run) {
    const w = store.state.programs[customIdOf(run.programRef) ?? ""]?.workouts.find((x) => x.key === s.workoutKey);
    if (w) return w.short;
  }
  return s.runId ? shortFor(s.title) : "Free";
}

function entriesFor(iso: string, today: string): Entry[] {
  const out: Entry[] = sessionsOn(iso).map((s) => ({ kind: "session" as const, session: s, short: sessionShort(s) }));
  for (const run of Object.values(store.state.runs)) {
    for (const [n, d] of Object.entries(run.days)) {
      if (d.date === iso && !d.sessionId) out.push({ kind: "rest", run, day: Number(n), status: d.status });
    }
  }
  const run = activeRun();
  if (run && run.status === "active" && iso >= today) {
    for (const [n, date] of Object.entries(projection(run).dates)) {
      const day = Number(n);
      if (date !== iso || run.days[day]) continue;
      if (out.some((e) => e.kind === "session" && e.session.runId === run.id && e.session.day === day)) continue;
      const slot = runSlot(run, day);
      if (!slot) continue;
      out.push({ kind: "planned", run, day, short: slot.short, title: slot.type === "rest" ? "Rest day" : slot.name, rest: slot.type === "rest" });
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Render
 * ------------------------------------------------------------------------- */

export function renderCalendar(): string {
  const today = todayISO();
  selected ??= today;
  monthCursor ??= firstOfMonth(selected);
  const first = parseISO(monthCursor)!;
  const year = first.getFullYear(), month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first week
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" }));

  const cells: string[] = [];
  for (let i = 0; i < lead; i++) cells.push(`<span class="mday mday--blank" aria-hidden="true"></span>`);
  for (let d = 1; d <= daysInMonth; d++) cells.push(dayCell(toISO(new Date(year, month, d)), today));

  const run = activeRun();
  const monthLabel = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const eyebrow = run ? `${esc(runProgramName(run))} · ${esc(finishLine(run))}` : "Training log";
  const planLink = isBuiltin(run) ? ` The 60-day plan by cycle is on the <a class="text-link" href="#/progress">Progress</a> tab.` : "";

  return `
    ${pageHeader("Calendar", { eyebrow })}
    <section class="month card" aria-label="${esc(monthLabel)}">
      <header class="month__head">
        <button class="icon-btn month__nav" data-action="month-prev" aria-label="Previous month">${ICON.back}</button>
        <h2 class="month__title" aria-live="polite">${esc(monthLabel)}</h2>
        <button class="icon-btn month__nav" data-action="month-next" aria-label="Next month">${ICON.chevron}</button>
      </header>
      <div class="month__grid" role="grid">
        ${weekdays.map((w) => `<span class="month__dow" role="columnheader">${esc(w)}</span>`).join("")}
        ${cells.join("")}
      </div>
      ${firstOfMonth(today) !== monthCursor || selected !== today
        ? `<div class="month__foot"><button class="btn btn--ghost btn--sm" data-action="month-today">Today</button></div>` : ""}
    </section>
    ${detailCard(selected, today)}
    <ul class="legend" aria-label="Legend">
      <li><span class="legend__sw is-completed"></span>Trained</li>
      <li><span class="legend__sw is-planned"></span>Planned</li>
      <li><span class="legend__sw is-rest"></span>Rest</li>
      <li><span class="legend__sw is-current"></span>Today</li>
    </ul>
    <p class="fineprint">Past dates show what you actually did. Upcoming dates show your plan if you train every planned day; skip a day and the rest moves back.${planLink}</p>`;
}

function dayCell(iso: string, today: string) {
  const entries = entriesFor(iso, today);
  const d = parseISO(iso)!.getDate();
  const cls = ["mday"];
  if (iso === today) cls.push("is-today");
  if (iso === selected) cls.push("is-selected");
  const primary = entries[0];
  let tag = "";
  const parts: string[] = [fmtLongDate(iso)];

  if (primary) {
    cls.push("is-in");
    if (primary.kind === "session") {
      cls.push(primary.session.status === "done" ? "is-completed" : "is-progress");
      tag = primary.short;
    } else if (primary.kind === "rest") {
      cls.push(primary.status === "done" ? "is-rest" : "is-skipped");
      tag = primary.status === "done" ? "Rest" : "Skip";
    } else {
      cls.push("is-planned");
      if (primary.rest) cls.push("is-rest");
      tag = primary.rest ? "Rest" : primary.short;
    }
    for (const e of entries) {
      parts.push(e.kind === "session" ? `${e.session.status === "done" ? "trained" : "in progress"}: ${e.session.title}`
        : e.kind === "rest" ? (e.status === "done" ? "rest day" : "rest day skipped")
        : `planned: ${e.title}`);
    }
  }
  if (iso === today) parts.push("today");
  const more = entries.length > 1 ? `<span class="mday__more">+${entries.length - 1}</span>` : "";
  const mark = primary?.kind === "session" && primary.session.status === "done" ? `<span class="mday__mark mday__mark--done">${ICON.check}</span>` : "";

  return `<button class="${cls.join(" ")}" role="gridcell" data-action="pick-date" data-date="${iso}" aria-pressed="${iso === selected}" aria-label="${esc(parts.join(", "))}">
    <span class="mday__n">${d}</span>${tag ? `<span class="mday__tag">${esc(tag)}</span>` : ""}${more}${mark}</button>`;
}

function detailCard(iso: string, today: string) {
  const entries = entriesFor(iso, today);
  const when = iso === today ? "Today" : fmtDate(iso, { weekday: "long" });
  const activeId = store.state.activeRunId;
  const items = entries.map((e) => {
    if (e.kind === "session") {
      const s = e.session;
      const run = s.runId ? store.state.runs[s.runId] : null;
      const href = run && s.day && run.id === activeId ? `#/day/${s.day}` : `#/log/${s.id}`;
      const what = run ? `${esc(run.name)}${s.day ? ` · Day ${s.day}` : ""}` : "Free workout";
      return `<a class="day-item" href="${href}">
        <span class="day-item__tag ${s.status === "done" ? "is-done" : ""}">${esc(e.short)}</span>
        <span class="day-item__main"><strong>${esc(s.title)}</strong><small>${what} · ${s.status === "done" ? "Done" : "In progress"}</small></span>${ICON.chevron}</a>`;
    }
    if (e.kind === "rest") {
      const href = e.run.id === activeId ? `#/day/${e.day}` : "#/programs";
      return `<a class="day-item" href="${href}">
        <span class="day-item__tag is-rest">${e.status === "done" ? "Rest" : "Skip"}</span>
        <span class="day-item__main"><strong>${e.status === "done" ? "Rest day" : "Rest day skipped"}</strong><small>${esc(e.run.name)} · Day ${e.day}</small></span>${ICON.chevron}</a>`;
    }
    const slot = runSlot(e.run, e.day);
    return `<a class="day-item is-planned" href="#/day/${e.day}">
      <span class="day-item__tag ${e.rest ? "is-rest" : ""}">${esc(e.rest ? "Rest" : e.short)}</span>
      <span class="day-item__main"><strong>${esc(e.title)}</strong><small>Planned · ${esc(e.run.name)} · Day ${e.day}</small></span>
      ${slot?.type === "workout" && slot.intensity ? pill(slot.intensity) : e.rest ? restPill() : ""}${ICON.chevron}</a>`;
  });

  const empty = iso < today
    ? `<p class="muted">No training logged on this day.</p>`
    : `<p class="muted">Nothing planned for this day.</p>`;
  const logBtn = iso <= today
    ? `<button class="btn btn--ghost btn--block" data-action="free-workout" data-date="${iso}">${ICON.plus}<span>Log a free workout on this day</span></button>`
    : "";
  return `<section class="card day-detail">
    <p class="eyebrow">${esc(when)} · ${esc(fmtLongDate(iso))}</p>
    ${items.length ? `<div class="day-items">${items.join("")}</div>` : empty}
    ${logBtn}
  </section>`;
}
