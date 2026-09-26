import { pageHeader } from "../components/ui";
import { store } from "../lib/state";
import { session } from "../lib/sync";
import { cloudEnabled } from "../lib/supabase";
import { esc } from "../lib/utils";

function segmented(name: string, value: string, opts: [string, string][]) {
  return `<div class="segmented">${opts.map(([v, l]) =>
    `<label><input type="radio" name="${name}" value="${v}" ${value === v ? "checked" : ""} data-setting="${name}"><span>${l}</span></label>`).join("")}</div>`;
}

export function renderSettings(): string {
  const s = store.state.settings;
  return `
    ${pageHeader("Settings", { back: "#/more" })}
    ${cloudEnabled ? `
    <section class="card form account">
      <div><p class="label">Signed in as</p><p class="account__email">${esc(session.email)}</p></div>
      <button class="btn btn--ghost" data-action="sign-out">Log out</button>
    </section>` : ""}

    <h2 class="section__title section__title--spaced">Programme</h2>
    <section class="card form">
      <div class="field">
        <label for="set-start">Start date</label>
        <input id="set-start" type="date" class="input" value="${esc(s.startDate)}" data-setting="startDate" aria-describedby="set-start-help set-start-err">
        <p class="field__help" id="set-start-help">Day 1 is this date. Logs stay attached to their programme day.</p>
        <p class="field__err" id="set-start-err" role="alert" hidden></p>
      </div>
      <fieldset class="field"><legend>Weight unit</legend>${segmented("weightUnit", s.weightUnit, [["kg", "kg"], ["lb", "lb"]])}
        <p class="field__help">Existing logs are converted for display.</p></fieldset>
      <fieldset class="field"><legend>Theme</legend>${segmented("theme", s.theme, [["system", "System"], ["light", "Light"], ["dark", "Dark"]])}</fieldset>
      <fieldset class="field"><legend>Timer sounds</legend>${segmented("sound", s.sound ? "on" : "off", [["on", "On"], ["off", "Off"]])}
        <p class="field__help">Beeps for warm-up, stretching and the end of your rest. The screen stays on while a timer runs.</p></fieldset>
    </section>

    <h2 class="section__title section__title--spaced">Your data</h2>
    <section class="card form">
      <p class="muted">${cloudEnabled
        ? "Your data is stored in your private account and cached on this device for offline use. You can also download a copy as a file."
        : "Your data lives only in this browser. Export a copy now and then, especially before clearing browser data."}</p>
      <div class="btn-row">
        <button class="btn btn--ghost" data-action="export">Export my data</button>
        <label class="btn btn--ghost" for="import-file">Import data</label>
        <input id="import-file" type="file" accept="application/json,.json" class="sr-only" data-change="import" aria-describedby="import-err">
      </div>
      <p class="field__err" id="import-err" role="alert" hidden></p>
    </section>

    <h2 class="section__title section__title--spaced">Danger zone</h2>
    <section class="card form">
      <div class="danger-row">
        <div><p class="danger-row__title">Reset programme</p><p class="muted">Removes day completion and workout logs. Keeps settings and body weight.</p></div>
        <button class="btn btn--danger-ghost" data-action="reset">Reset</button>
      </div>
      <div class="danger-row">
        <div><p class="danger-row__title">Clear all data</p><p class="muted">Deletes all programmes, logs and body weight${cloudEnabled ? " from your account" : ""}, and returns to setup.</p></div>
        <button class="btn btn--danger-ghost" data-action="clear-all">Clear</button>
      </div>
    </section>
    <p class="fineprint">No analytics or tracking.${cloudEnabled ? " Only you can read your data (enforced by the database)." : " Nothing leaves this device."}</p>`;
}
