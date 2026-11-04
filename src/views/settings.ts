import { pageHeader } from "../components/ui";
import { store } from "../lib/state";
import { session } from "../lib/sync";
import { cloudEnabled } from "../lib/supabase";
import { esc } from "../lib/utils";
import { ICON } from "../components/icons";
import { SWATCHES } from "../data/theme-swatches";
import { PALETTES, paletteDef, resolveMode, systemDark } from "../lib/theme";

/* Preview colours for the original theme (main.css); the others are generated. */
const CLASSIC = {
  light: { bg: "#f3f2ee", surface: "#ffffff", primary: "#ffc61a", soft: "#fff2c7" },
  dark: { bg: "#0f0f0e", surface: "#181817", primary: "#ffc61a", soft: "#3a300c" },
};

function appearance(): string {
  const s = store.state.settings;
  const def = paletteDef(s.palette);
  const darkOnly = def.modes.length === 1;
  const shown = resolveMode(s.palette, s.theme);
  const note = darkOnly ? `${def.name} is a dark-only theme, so this setting is paused.`
    : s.theme === "system" ? `Follows your device: ${systemDark() ? "dark" : "light"} right now.` : "";
  const modes: [string, string][] = [["light", "Light"], ["dark", "Dark"], ["system", "System"]];
  return `
    <section class="card form appearance">
      <fieldset class="field"><legend>Light or dark</legend>
        <div class="segmented">${modes.map(([v, l]) =>
          `<label><input type="radio" name="theme" value="${v}" ${s.theme === v ? "checked" : ""} ${darkOnly ? "disabled" : ""} data-setting="theme"><span>${l}</span></label>`).join("")}</div>
        ${note ? `<p class="field__help" id="mode-note">${esc(note)}</p>` : ""}
      </fieldset>
      <fieldset class="field"><legend>Colour theme</legend>
        <div class="palettes">${PALETTES.map((p) => {
          const sw = (p.id === "classic" ? CLASSIC : SWATCHES[p.id]!)[p.modes.includes(shown) ? shown : p.modes[0]!];
          return `<label class="palette">
            <input type="radio" name="palette" value="${p.id}" ${s.palette === p.id ? "checked" : ""} data-setting="palette">
            <span class="palette__card"><md-ripple></md-ripple>
              <span class="palette__preview" aria-hidden="true" style="background:${sw.bg}">
                <i style="background:${sw.surface}"></i><i style="background:${sw.soft}"></i>
                <b class="palette__bar" style="background:${sw.primary}"></b><b class="palette__dot" style="background:${sw.primary}"></b>
              </span>
              <span class="palette__name"><b>${esc(p.name)}</b><span class="palette__check">${ICON.check}<span class="sr-only">selected</span></span></span>
              <span class="palette__desc">${esc(p.desc)}${p.id === "classic" ? " · Default" : ""}</span>
            </span>
          </label>`;
        }).join("")}</div>
      </fieldset>
      <div class="appearance__foot">
        <p class="field__help">Saved on this device. It never changes your data.</p>
        <md-outlined-button data-action="reset-appearance">Use the default theme</md-outlined-button>
      </div>
    </section>`;
}

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

    <h2 class="section__title section__title--spaced">Appearance</h2>
    ${appearance()}

    <h2 class="section__title section__title--spaced">Preferences</h2>
    <section class="card form">
      <fieldset class="field"><legend>Weight unit</legend>${segmented("weightUnit", s.weightUnit, [["kg", "kg"], ["lb", "lb"]])}
        <p class="field__help">Existing logs are converted for display.</p></fieldset>
      <div class="field">
        <label for="set-goal">Weekly goal</label>
        <select id="set-goal" class="input" data-setting="weeklyGoal">
          ${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${s.weeklyGoal === n ? "selected" : ""}>${n} workout${n === 1 ? "" : "s"} a week</option>`).join("")}
        </select>
        <p class="field__help">Shown on Today with your streak, and in the Sunday summary.</p>
      </div>
      <div class="field field--switch">
        <label for="set-sound">Timer sounds</label>
        <md-switch id="set-sound" icons ${s.sound ? "selected" : ""} data-setting="sound" aria-describedby="sound-help"></md-switch>
        <p class="field__help" id="sound-help">Beeps for warm-up, stretching and the end of your rest. The screen stays on while a timer runs.</p>
      </div>
    </section>

    <h2 class="section__title section__title--spaced">Reminders</h2>
    <section class="card form">
      <p class="muted">Motivation at ${esc(store.state.notify.quoteTime)}, gym reminder before ${esc(store.state.notify.gymTime)}, and a nightly “did you skip?” check.</p>
      <a class="btn btn--ghost" href="#/reminders">Reminder settings</a>
    </section>

    <h2 class="section__title section__title--spaced">Programs</h2>
    <section class="card form">
      <p class="muted">Start dates, switching programs and building your own live under Programs.</p>
      <a class="btn btn--ghost" href="#/programs">Open programs</a>
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
        <div><p class="danger-row__title">Restart current program</p><p class="muted">Starts your active program again from Day 1 today. Your logged workouts stay in your history.</p></div>
        <button class="btn btn--danger-ghost" data-action="restart-run">Restart</button>
      </div>
      <div class="danger-row">
        <div><p class="danger-row__title">Clear all data</p><p class="muted">Deletes all programs, workout logs and body weight${cloudEnabled ? " from your account" : ""}, and returns to setup.</p></div>
        <button class="btn btn--danger-ghost" data-action="clear-all">Clear</button>
      </div>
    </section>
    <p class="fineprint">No analytics or tracking.${cloudEnabled ? " Only you can read your data (enforced by the database)." : " Nothing leaves this device."}</p>`;
}
