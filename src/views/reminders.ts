/*
 * #/reminders — notification settings (6 pm quote, gym reminder, "did you skip?" check, weekly summary)
 * #/install   — how to install the app (needed for reminders on iPhone)
 */
import { ICON } from "../components/icons";
import { pageHeader } from "../components/ui";
import { installState } from "../lib/install";
import { currentSubscription, isIOS, isStandalone, permission, pushConfigured, pushSupported } from "../lib/push";
import { store } from "../lib/state";
import { cloudEnabled } from "../lib/supabase";
import { $, esc } from "../lib/utils";

const at = (time: string, minusMin = 0) => {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const t = (h * 60 + m - minusMin + 1440) % 1440;
  return new Date(2024, 0, 1, Math.floor(t / 60), t % 60).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

const toggle = (field: string, on: boolean, label: string) =>
  `<label class="switch"><input type="checkbox" data-notify="${field}" ${on ? "checked" : ""}><span class="switch__track" aria-hidden="true"></span><span class="switch__label">${label}</span></label>`;

export function renderReminders(): string {
  const n = store.state.notify;
  let tz = "your time zone";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* keep */ }

  const blocker = !cloudEnabled
    ? "Reminders need an account. They're sent by the server, so they don't work in local-only mode."
    : !pushConfigured()
      ? "Reminders aren't set up on the server yet. Follow docs/REMINDERS_SETUP.md (one-time), then reload."
      : isIOS() && !isStandalone()
        ? "On iPhone, notifications only work once the app is installed to your Home Screen."
        : !pushSupported()
          ? "This browser can't receive notifications. Try Chrome, Edge or Safari."
          : "";

  return `
    ${pageHeader("Reminders", { back: "#/more", sub: "Notifications arrive even when the app is closed. Times use your phone's time zone." })}
    <section class="card form" id="push-device">
      ${blocker
        ? `<div class="notice">${ICON.info}<span>${esc(blocker)}</span></div>
           ${isIOS() && !isStandalone() ? `<a class="btn btn--primary btn--block" href="#/install">How to install on iPhone</a>` : ""}`
        : `<p class="muted" id="push-status">Checking this device…</p>
           <div class="btn-row" id="push-actions"></div>`}
    </section>

    <h2 class="section__title section__title--spaced">What to send</h2>
    <section class="card form reminders ${n.enabled ? "" : "is-off"}">
      <div class="reminder">
        ${toggle("quoteEnabled", n.quoteEnabled, "Daily motivation quote")}
        <div class="reminder__time"><label for="r-quote">At</label><input id="r-quote" type="time" class="input input--compact" value="${n.quoteTime}" data-notify="quoteTime"></div>
      </div>
      <div class="reminder">
        ${toggle("gymEnabled", n.gymEnabled, "Gym reminder")}
        <div class="reminder__time"><label for="r-gym">Gym at</label><input id="r-gym" type="time" class="input input--compact" value="${n.gymTime}" data-notify="gymTime"></div>
        <div class="reminder__time"><label for="r-before">Remind me</label>
          <select id="r-before" class="input input--compact" data-notify="remindBefore">
            ${[0, 15, 30, 45, 60, 90, 120].map((m) => `<option value="${m}" ${n.remindBefore === m ? "selected" : ""}>${m ? `${m} min before` : "At gym time"}</option>`).join("")}
          </select></div>
        <p class="field__help">Sent at ${esc(at(n.gymTime, n.remindBefore))}. Skipped on rest days and once you've logged a workout.</p>
      </div>
      <div class="reminder">
        ${toggle("skipCheckEnabled", n.skipCheckEnabled, "“Did you skip today?” check")}
        <div class="reminder__time"><label for="r-skip">At</label><input id="r-skip" type="time" class="input input--compact" value="${n.skipCheckTime}" data-notify="skipCheckTime"></div>
        <p class="field__help">Only if nothing is logged that day. The app also asks about past days with nothing logged.</p>
      </div>
      <div class="reminder">
        ${toggle("weeklyEnabled", n.weeklyEnabled, "Weekly summary (Sundays, 9 pm)")}
      </div>
      <p class="fineprint">Time zone: ${esc(tz)}.${n.enabled ? "" : " Turn notifications on above to start receiving these."}</p>
    </section>`;
}

/** Fill in this device's notification state (async: needs the service worker). */
export async function hydrateReminders() {
  const status = $("#push-status"), actions = $("#push-actions");
  if (!status || !actions) return;
  const perm = permission();
  const sub = await currentSubscription().catch(() => null);
  if (perm === "denied") {
    status.innerHTML = `${ICON.alert} Notifications are blocked for this site. Allow them in your browser's site settings, then reload.`;
    actions.innerHTML = "";
  } else if (perm === "granted" && sub) {
    status.innerHTML = `<strong class="ok-text">${ICON.check} On for this device.</strong> ${store.state.notify.enabled ? "" : "Reminders are paused for your account."}`;
    actions.innerHTML = `<button class="btn btn--primary" data-action="notify-test">${ICON.bell}<span>Send a test</span></button>
      <button class="btn btn--ghost" data-action="notify-off">Turn off on this device</button>`;
  } else {
    status.textContent = "Notifications are off on this device.";
    actions.innerHTML = `<button class="btn btn--primary btn--block" data-action="notify-on">${ICON.bell}<span>Turn on notifications</span></button>`;
  }
}

export function renderInstall(): string {
  const st = installState();
  return `
    ${pageHeader("Install the app", { back: "#/more", sub: "Installed, it opens full-screen from your home screen like a normal app." })}
    ${st === "installed" ? `<div class="notice notice--ok">${ICON.check}<span>You're using the installed app.</span></div>` : ""}
    ${st === "prompt" ? `<button class="btn btn--primary btn--lg btn--block" data-action="install-app">${ICON.download}<span>Install now</span></button>` : ""}
    <h2 class="section__title section__title--spaced">iPhone / iPad (Safari)</h2>
    <ol class="card steps">
      <li>Open this site in <strong>Safari</strong>.</li>
      <li>Tap the <strong>Share</strong> button (square with an arrow).</li>
      <li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
      <li>Open the app from your Home Screen, then go to <strong>More → Reminders</strong> to turn on notifications.</li>
    </ol>
    <h2 class="section__title section__title--spaced">Android (Chrome)</h2>
    <ol class="card steps">
      <li>Tap the <strong>⋮</strong> menu.</li>
      <li>Choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</li>
    </ol>
    <h2 class="section__title section__title--spaced">Laptop (Chrome / Edge)</h2>
    <ol class="card steps">
      <li>Click the install icon at the right of the address bar, or the menu → <strong>Install 60 Days Tracker</strong>.</li>
    </ol>`;
}
