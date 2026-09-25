import { store } from "../lib/state";
import { esc, todayISO } from "../lib/utils";

export function renderOnboarding(): string {
  const unit = store.state.settings.weightUnit;
  return `
    <section class="onboard">
      <div class="onboard__mark" aria-hidden="true"><span class="brand-mark brand-mark--lg">60</span></div>
      <p class="eyebrow">Strength &amp; muscle building</p>
      <h1 class="onboard__title">60 days.<br>5 cycles.<br>Let's go.</h1>
      <p class="onboard__lede">Pick your start date. Day 1 begins that day, and every day after follows the calendar.</p>
      <form class="card form" data-form="onboard" novalidate>
        <div class="field">
          <label for="ob-date">Start date</label>
          <input id="ob-date" name="startDate" type="date" class="input" value="${esc(todayISO())}" required aria-describedby="ob-err">
        </div>
        <fieldset class="field">
          <legend>Weight unit</legend>
          <div class="segmented">
            <label><input type="radio" name="unit" value="kg" ${unit === "kg" ? "checked" : ""}><span>kg</span></label>
            <label><input type="radio" name="unit" value="lb" ${unit === "lb" ? "checked" : ""}><span>lb</span></label>
          </div>
        </fieldset>
        <p class="field__err" id="ob-err" role="alert" hidden></p>
        <button class="btn btn--primary btn--block btn--lg" type="submit">Start programme</button>
      </form>
    </section>`;
}
