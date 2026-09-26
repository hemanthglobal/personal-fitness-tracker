import { getSchedule, INTENSITY, REST_ACTIVITIES, TOTAL_DAYS } from "../data/workout-data";
import { dateForDay, dayStatus, isDayComplete } from "../lib/state";
import { esc, fmtDate } from "../lib/utils";
import { routineMinutes, STRETCHES } from "../data/routines";
import { ICON } from "./icons";
import { pill, restPill } from "./ui";

export function restButton(day: number, extra = "") {
  return isDayComplete(day)
    ? `<button class="btn btn--on-dark btn--block ${extra}" data-action="toggle-rest" data-day="${day}" aria-pressed="true">${ICON.check}<span>Rest day complete</span></button>`
    : `<button class="btn btn--primary btn--block ${extra}" data-action="toggle-rest" data-day="${day}" aria-pressed="false">Mark rest day complete</button>`;
}

export function restHero(day: number, eyebrow: string, title?: string) {
  return `
    <section class="hero hero--rest ${isDayComplete(day) ? "is-complete" : ""}">
      <p class="hero__eyebrow">${eyebrow}</p>
      ${title ? `<p class="hero__title">${title}</p>` : ""}
      <p class="hero__meta">Active rest is recommended. Options from the programme:</p>
      <ul class="chips chips--on-dark">${REST_ACTIVITIES.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
      ${restButton(day, "btn--lg")}
      <a class="hero__link" href="#/session/stretch/full/${day}">${ICON.leaf}<span>Full-body stretch · ${routineMinutes(STRETCHES.full)} min guided</span>${ICON.chevron}</a>
    </section>`;
}

/** Compact list of the next few days. */
export function upcomingList(from: number, count: number) {
  const days: number[] = [];
  for (let d = from; d <= TOTAL_DAYS && days.length < count; d++) days.push(d);
  if (!days.length) return "";
  return `<section class="section">
    <h2 class="section__title">Coming up</h2>
    <ul class="card list-rows">
      ${days.map((d) => {
        const s = getSchedule(d)!;
        return `<li><a class="list-row list-row--link" href="#/day/${d}">
          <span class="list-row__day">${d}</span>
          <span class="list-row__main">${s.type === "rest" ? "Rest day" : esc(s.name)}<small>${esc(fmtDate(dateForDay(d)))}</small></span>
          ${s.type === "rest" ? restPill() : pill(s.intensity)}
        </a></li>`;
      }).join("")}
    </ul>
  </section>`;
}

/** Calendar tile for one day. */
export function dayTile(d: number) {
  const s = getSchedule(d)!;
  const st = dayStatus(d);
  const rest = s.type === "rest";
  const stText = { completed: "Completed", current: "Today", missed: "Not completed", past: "", upcoming: "" }[st];
  const label = `Day ${d}, ${rest ? "rest day" : `workout ${s.workout}, ${s.name}, ${s.intensity}`}, ${fmtDate(dateForDay(d))}${stText ? `, ${stText}` : ""}`;
  const badge =
    st === "completed" ? `<span class="tile__badge tile__badge--done">${ICON.check}</span>`
    : st === "current" ? '<span class="tile__badge tile__badge--now">Today</span>'
    : st === "missed" ? `<span class="tile__badge tile__badge--missed">${ICON.alert}</span>` : "";
  return `<li><a class="tile is-${st} ${rest ? "is-rest" : ""}" href="#/day/${d}" aria-label="${esc(label)}">
    <span class="tile__top"><span class="tile__day">Day ${d}</span>${badge}</span>
    <span class="tile__letter">${rest ? "Rest" : s.workout}</span>
    <span class="tile__sub">${rest ? "Active rest" : `<b>${INTENSITY[s.intensity].label}</b> · ${esc(s.name.split(" / ")[0]!)}`}</span>
    <span class="tile__date">${esc(fmtDate(dateForDay(d), { weekday: "short", day: "numeric" }))}</span>
  </a></li>`;
}
