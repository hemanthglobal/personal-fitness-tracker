import { store } from "../lib/state";
import { esc, todayISO } from "../lib/utils";

export function renderOnboarding(): string {
  const unit = store.state.settings.weightUnit;
  return `
    <section class="onboard">
      <div class="onboard__mark" aria-hidden="true"><span class="brand-mark brand-mark--lg">60</span></div>
      <p class="eyebrow">Your training log</p>
      <h1 class="onboard__title">Let's get you set up.</h1>
      <p class="onboard__lede">Pick a program to follow. You can switch programs later and keep your history.</p>
      <form class="card form" data-form="onboard" novalidate>
        <fieldset class="field">
          <legend>Program</legend>
          <div class="choice-list">
            <label class="choice"><input type="radio" name="program" value="builtin" checked>
              <span><strong>60 Days to Fit</strong><small>60 days · light &amp; heavy training from the PDF</small></span></label>
            <label class="choice"><input type="radio" name="program" value="template">
              <span><strong>Push / Pull / Legs + Upper / Lower</strong><small>7-day template you can edit</small></span></label>
            <label class="choice"><input type="radio" name="program" value="none">
              <span><strong>Not yet</strong><small>Just log free workouts for now</small></span></label>
          </div>
        </fieldset>
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
        <button class="btn btn--primary btn--block btn--lg" type="submit">Get started</button>
      </form>
    </section>`;
}
