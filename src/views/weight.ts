import { ICON } from "../components/icons";
import { emptyState, pageHeader } from "../components/ui";
import { fmtW, sortedWeights, unit } from "../lib/state";
import { esc, fmtDate, todayISO } from "../lib/utils";
import { weightChart, weightStats } from "./progress";

export function renderWeight(): string {
  const w = sortedWeights();
  const last = w[w.length - 1];
  return `
    ${pageHeader("Body weight", { back: "#/more", sub: "Optional. Log whenever you like." })}
    <form class="card form" data-form="weight" novalidate>
      <div class="form__row">
        <div class="field">
          <label for="bw-date">Date</label>
          <input id="bw-date" name="date" type="date" class="input" value="${todayISO()}" max="${todayISO()}" required>
        </div>
        <div class="field">
          <label for="bw-weight">Weight</label>
          <div class="input-unit"><input id="bw-weight" name="weight" class="input" inputmode="decimal" autocomplete="off"
            placeholder="${last ? fmtW(last.weight) : "0.0"}" aria-describedby="bw-err"><span>${unit()}</span></div>
        </div>
      </div>
      <p class="field__err" id="bw-err" role="alert" hidden></p>
      <div class="field">
        <label for="bw-notes">Notes <span class="muted">(optional)</span></label>
        <input id="bw-notes" name="notes" class="input" maxlength="500" autocomplete="off" placeholder="Morning, before breakfast">
      </div>
      <button class="btn btn--primary btn--block" type="submit">Save entry</button>
    </form>
    ${w.length ? `<section class="section"><div class="card">${weightStats(w)}${w.length >= 2 ? weightChart(w) : ""}</div></section>` : ""}
    <section class="section">
      <h2 class="section__title">History</h2>
      ${w.length
        ? `<ul class="card list-rows">${w.slice().reverse().map((e) => `<li class="list-row">
            <span class="list-row__main">${esc(fmtDate(e.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }))}${e.notes ? `<small>${esc(e.notes)}</small>` : ""}</span>
            <span class="list-row__value">${fmtW(e.weight)} ${unit()}</span>
            <button class="icon-btn" data-action="delete-weight" data-date="${e.date}" aria-label="Delete entry for ${esc(fmtDate(e.date))}">${ICON.close}</button>
          </li>`).join("")}</ul>`
        : emptyState("No weight entries yet.", "Add your first measurement to start tracking.")}
    </section>`;
}
