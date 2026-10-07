import { REST_ACTIVITIES } from "../data/workout-data";
import { routineMinutes, STRETCHES } from "../data/routines";
import { dayStatus, isBuiltin, planDate, projection, runLength, runSlot, type Run } from "../lib/state";
import { addDays, esc, fmtDate, todayISO } from "../lib/utils";
import { ICON } from "./icons";
import { pill, restPill } from "./ui";

/** "Today", "Tomorrow", "Yesterday" or a short date. */
export function relDate(iso: string): string {
  const t = todayISO();
  if (iso === t) return "Today";
  if (iso === addDays(t, 1)) return "Tomorrow";
  if (iso === addDays(t, -1)) return "Yesterday";
  return fmtDate(iso);
}

/** Rest day card: tick it, or skip it and train instead. */
export function restHero(run: Run, day: number, eyebrow: string, title?: string) {
  const d = run.days[day];
  const actions = d
    ? `<button class="btn btn--on-dark btn--block btn--lg" data-action="rest-undo" data-day="${day}">
        ${d.status === "done" ? `${ICON.check}<span>Rested · undo</span>` : `<span>Skipped (trained instead) · undo</span>`}</button>`
    : `<button class="btn btn--primary btn--block btn--lg" data-action="rest-done" data-day="${day}">Mark rest day complete</button>
       <button class="btn btn--on-dark btn--block" data-action="rest-skip" data-day="${day}">Train instead · skip this rest day</button>`;
  return `
    <section class="hero hero--rest ${d?.status === "done" ? "is-complete" : ""}">
      <p class="hero__eyebrow">${eyebrow}</p>
      ${title ? `<p class="hero__title">${title}</p>` : ""}
      <p class="hero__meta">Active rest is recommended${isBuiltin(run) ? ". Options from the programme:" : ", for example:"}</p>
      <ul class="chips chips--on-dark">${REST_ACTIVITIES.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
      <div class="stack-sm">${actions}</div>
      <a class="hero__link" href="#/session/stretch/full/${day}">${ICON.leaf}<span>Full-body stretch · ${routineMinutes(STRETCHES.full)} min guided</span>${ICON.chevron}</a>
    </section>`;
}

/** The next few not-yet-done days of a run, with their projected dates. */
export function upcomingList(run: Run, from: number, count: number) {
  const days: number[] = [];
  const last = runLength(run) ?? from + count + 30;
  for (let d = from; d <= last && days.length < count; d++) if (!run.days[d] && runSlot(run, d)) days.push(d);
  if (!days.length) return "";
  return `<section class="section">
    <h2 class="section__title">Coming up</h2>
    <ul class="card list-rows">
      ${days.map((d) => {
        const s = runSlot(run, d)!;
        return `<li><a class="list-row list-row--link" href="#/day/${d}">
          <span class="list-row__day">${d}</span>
          <span class="list-row__main">${s.type === "rest" ? "Rest day" : esc(s.name)}<small>${esc(relDate(planDate(run, d)))}</small></span>
          ${s.type === "rest" ? restPill() : s.intensity ? pill(s.intensity) : `<span class="pill pill--light">${esc(s.short)}</span>`}
        </a></li>`;
      }).join("")}
    </ul>
  </section>`;
}

/** Plan tile for one day of a run. */
export function dayTile(run: Run, d: number) {
  const s = runSlot(run, d);
  if (!s) return "";
  const st = dayStatus(run, d);
  const rest = s.type === "rest";
  const date = planDate(run, d);
  const nowLabel = date === todayISO() ? "Today" : "Next";
  const stText = { done: "Done", skipped: "Skipped", current: nowLabel === "Today" ? "Today" : "Next up", upcoming: "" }[st];
  const label = `Day ${d}, ${rest ? "rest day" : `${s.name}${s.intensity ? `, ${s.intensity}` : ""}`}, ${st === "done" || st === "skipped" ? "" : "planned "}${fmtDate(date)}${stText ? `, ${stText}` : ""}`;
  const badge =
    st === "done" ? `<span class="tile__badge tile__badge--done">${ICON.check}</span>`
    : st === "skipped" ? `<span class="tile__badge tile__badge--skip">Skip</span>`
    : st === "current" ? `<span class="tile__badge tile__badge--now">${nowLabel}</span>` : "";
  const cls = st === "done" ? "is-completed" : `is-${st}`;
  return `<li><a class="tile ${cls} ${rest ? "is-rest" : ""}" href="#/day/${d}" aria-label="${esc(label)}">
    <span class="tile__top"><span class="tile__day">Day ${d}</span>${badge}</span>
    <span class="tile__letter">${rest ? "Rest" : esc(s.letter ?? s.short)}</span>
    <span class="tile__sub">${rest ? "Active rest" : s.intensity ? `<b>${s.intensity === "light" ? "Light" : "Heavy"}</b> · ${esc(s.name.split(" / ")[0]!)}` : `${s.exercises.length} exercises`}</span>
    <span class="tile__date">${esc(fmtDate(date, { weekday: "short", day: "numeric", month: "short" }))}</span>
  </a></li>`;
}

/** Projected finish line, e.g. "Finishes 24 Nov · 1 day later than planned". */
export function finishLine(run: Run): string {
  const p = projection(run);
  if (!p.finish) return "Runs until you stop it";
  const f = fmtDate(p.finish, { day: "numeric", month: "short", year: "numeric" });
  if (run.status !== "active") return `Ended ${f}`;
  return p.slip > 0 ? `Finishes ${f} · ${p.slip} day${p.slip === 1 ? "" : "s"} later than first planned` : `Finishes ${f}`;
}
