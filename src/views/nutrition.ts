import { NUTRITION as N } from "../data/workout-data";
import { ICON } from "../components/icons";
import { healthNotice, pageHeader } from "../components/ui";
import { esc } from "../lib/utils";

export function renderNutrition(): string {
  return `
    ${pageHeader("Nutrition reference", { back: "#/more", sub: "From the programme PDF. These are the source's example numbers, not a personal prescription." })}
    <section class="section">
      <h2 class="section__title">Macro formulas <span class="tag">Source</span></h2>
      <ul class="card list-rows">
        ${N.formulas.map((f) => `<li class="list-row"><span class="list-row__main">${f.macro}</span><span class="list-row__value">${f.perLb} g × bodyweight (lb)</span></li>`).join("")}
      </ul>
      <p class="fineprint">Daily amount = grams × bodyweight in pounds.</p>
    </section>
    <section class="section">
      <h2 class="section__title">Example day <span class="tag">Source example</span></h2>
      <ol class="meals">
        ${N.meals.map((m, i) => `<li class="meal card">
          <div class="meal__head"><span class="meal__n">Meal ${i + 1}</span><span class="muted">${m.time}</span></div>
          <ul class="meal__items">${m.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul>
          <div class="macros"><span>P ${m.p}g</span><span>F ${m.f}g</span><span>C ${m.c}g</span><span>${m.kcal} kcal</span></div>
        </li>`).join("")}
      </ol>
      <div class="card totals">
        <p class="label">Example total daily intake</p>
        <div class="totals__grid">
          <div><span>${N.total.p}</span><small>g protein</small></div><div><span>${N.total.f}</span><small>g fat</small></div>
          <div><span>${N.total.c}</span><small>g carbs</small></div><div><span>${N.total.kcal}</span><small>kcal</small></div>
        </div>
      </div>
    </section>
    <section class="section">
      <h2 class="section__title">Swaps</h2>
      <div class="card swaps">
        ${Object.entries(N.replacements).map(([k, v]) => `<div><p class="label">${k}</p><ul class="chips">${v.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}
      </div>
    </section>
    <div class="notice">${ICON.info}<span>${esc(N.waterTip)}</span></div>
    ${healthNotice()}`;
}
