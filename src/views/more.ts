import { CYCLE_PATTERN, INTENSITY, MINDSET_TIPS, SHOPPING, SUPPLEMENTS, VIDEO_URL, WORKOUTS } from "../data/workout-data";
import { ICON } from "../components/icons";
import { healthNotice, listLink, pageHeader, pill } from "../components/ui";
import { store } from "../lib/state";
import { session } from "../lib/sync";
import { cloudEnabled } from "../lib/supabase";
import { esc, plural } from "../lib/utils";

export function renderMore(): string {
  const n = store.state.bodyWeight.length;
  return `
    ${pageHeader("More")}
    <ul class="card list-rows">
      ${listLink("#/weight", ICON.scale, "Body weight", n ? plural(n, "entry", "entries") : "Optional log")}
      ${listLink("#/about", ICON.info, "Programme guide", "How the 60 days work")}
    </ul>
    <h2 class="section__title section__title--spaced">Reference</h2>
    <ul class="card list-rows">
      ${listLink("#/nutrition", ICON.leaf, "Nutrition reference", "Source example meal plan")}
      ${listLink("#/shopping", ICON.cart, "Shopping list", "Checklist from the programme")}
      ${listLink("#/supplements", ICON.capsule, "Supplements", "Optional, not required")}
    </ul>
    <h2 class="section__title section__title--spaced">App</h2>
    <ul class="card list-rows">
      ${listLink("#/settings", ICON.gear, "Settings", cloudEnabled ? esc(session.email) : "Start date, units, theme, backup")}
    </ul>`;
}

export const shopKey = (cat: string, item: string) => `${cat}::${item}`;

export function renderShopping(): string {
  const ticked = Object.keys(store.state.shopping).length;
  return `
    ${pageHeader("Shopping list", { back: "#/more", sub: "From the programme. Tick what you need or already have. No need to buy everything." })}
    <div class="toolbar"><span class="muted" id="shop-count">${ticked} ticked</span>${ticked ? '<button class="btn btn--ghost btn--sm" data-action="clear-shopping">Untick all</button>' : ""}</div>
    ${SHOPPING.map((g) => `<section class="section">
      <h2 class="section__title">${esc(g.category)}</h2>
      <ul class="card checklist">
        ${g.items.map((it) => {
          const k = shopKey(g.category, it);
          return `<li><label class="check-row"><input type="checkbox" data-shop="${esc(k)}" ${store.state.shopping[k] ? "checked" : ""}>
            <span class="check-row__box">${ICON.check}</span><span class="check-row__label">${esc(it)}</span></label></li>`;
        }).join("")}
      </ul></section>`).join("")}`;
}

export function renderSupplements(): string {
  return `
    ${pageHeader("Supplements", { back: "#/more" })}
    <div class="notice notice--ok">${ICON.info}<span>The programme says supplements are <strong>not required for success</strong>.</span></div>
    <ul class="card list-rows">
      ${SUPPLEMENTS.map((s) => `<li class="list-row list-row--stack"><span class="list-row__main">${esc(s.name)}<small>${esc(s.note)}</small></span></li>`).join("")}
    </ul>
    <p class="fineprint">Summarised from the programme PDF. Nothing here is a recommendation from this app.</p>
    ${healthNotice()}`;
}

export function renderAbout(): string {
  const L = INTENSITY.light, H = INTENSITY.heavy;
  const pattern = CYCLE_PATTERN.map((s, i) => `<li class="mini-tile ${s.rest ? "is-rest" : ""}"><span>${i + 1}</span><b>${s.rest ? "R" : s.workout}</b><small>${s.rest ? "Rest" : INTENSITY[s.intensity].label}</small></li>`).join("");
  const cycles = [1, 2, 3, 4, 5];
  return `
    ${pageHeader("Programme guide", { back: "#/more" })}
    <section class="card about-stats">
      <div><strong>60</strong><span>days</span></div><div><strong>5</strong><span>cycles</span></div><div><strong>2</strong><span>intensities</span></div>
    </section>
    <section class="section">
      <h2 class="section__title">The 12-day cycle</h2>
      <ol class="mini-grid" aria-label="12-day cycle pattern">${pattern}</ol>
      <ul class="card list-rows">
        ${Object.entries(WORKOUTS).map(([k, w]) => `<li class="list-row"><span class="list-row__day">${k}</span><span class="list-row__main">${esc(w.name)}</span></li>`).join("")}
      </ul>
      <p class="fineprint">8 workouts and 4 rest days per cycle. Each body part is trained once light and once heavy. The same cycle repeats 5 times.</p>
    </section>
    <section class="section">
      <h2 class="section__title">Reps by cycle</h2>
      <table class="card rep-table">
        <thead><tr><th scope="col">Cycle</th>${cycles.map((c) => `<th scope="col">${c}</th>`).join("")}</tr></thead>
        <tbody>
          <tr><th scope="row">${pill("light")}</th>${cycles.map((c) => `<td>${7 + c}</td>`).join("")}</tr>
          <tr><th scope="row">${pill("heavy")}</th>${cycles.map((c) => `<td>${3 + c}</td>`).join("")}</tr>
        </tbody>
      </table>
      <p class="fineprint">Pullups are always to failure.</p>
    </section>
    <section class="section">
      <h2 class="section__title">Tempo &amp; rest</h2>
      <div class="card two-col">
        <div><p>${pill("light")}</p><p><b>${L.tempoDetail}.</b></p><p class="muted">Rest ${L.rest}. No rest between exercises within a superset.</p></div>
        <div><p>${pill("heavy")}</p><p><b>${H.tempoDetail}.</b></p><p class="muted">Rest ${H.rest}. No rest between exercises within a superset.</p></div>
      </div>
    </section>
    <section class="section">
      <h2 class="section__title">Mindset</h2>
      <ul class="card list-rows">${MINDSET_TIPS.map((t) => `<li class="list-row list-row--stack"><span class="list-row__main">${esc(t)}</span></li>`).join("")}</ul>
    </section>
    <a class="card list-row list-row--link" href="${VIDEO_URL}" target="_blank" rel="noopener noreferrer">
      <span class="list-row__icon">${ICON.link}</span><span class="list-row__main">Video trainer<small>muscleandfitness.com/60days (from the PDF)</small></span>${ICON.chevron}
    </a>
    ${healthNotice()}`;
}
