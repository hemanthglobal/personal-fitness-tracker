/* Today-screen cards: skipped-day prompt, weekly goal + streak, quote of the day, install the app. */
import { quoteForDate } from "../data/quotes";
import { streak, unloggedDays, weekDates } from "../lib/habits";
import { installState } from "../lib/install";
import { loggedDates, sessionsSorted, store, trackingSince } from "../lib/state";
import { readJSON } from "../lib/storage";
import { esc, fmtDate, todayISO } from "../lib/utils";
import { ICON } from "./icons";

const minutesNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number) as [number, number]; return h * 60 + m; };

/** Dates waiting for an answer: past days with nothing logged, plus today after the skip-check time. */
export function datesToReview(): string[] {
  const today = todayISO();
  const logged = loggedDates();
  const out = unloggedDays(logged, trackingSince(), today, 7);
  const n = store.state.notify;
  const askToday = n.skipCheckEnabled && minutesNow() >= toMin(n.skipCheckTime) && !logged.has(today) && trackingSince() != null && trackingSince()! <= today;
  if (askToday) out.push(today);
  return out;
}

export function skipPrompt(): string {
  const dates = datesToReview();
  const date = dates[0];
  if (!date) return "";
  const today = todayISO();
  const label = date === today ? "today" : fmtDate(date, { weekday: "long", day: "numeric", month: "short" });
  const more = dates.length - 1;
  return `<section class="card skip-ask" aria-labelledby="skip-ask-title">
    <p class="eyebrow">Nothing logged${more ? ` · ${more} more day${more === 1 ? "" : "s"} to review` : ""}</p>
    <p class="skip-ask__title" id="skip-ask-title">Did you skip ${esc(label)}?</p>
    <div class="skip-ask__actions">
      <button class="btn btn--ghost btn--sm" data-action="mark-skip" data-date="${date}">Yes, skipped</button>
      <button class="btn btn--ghost btn--sm" data-action="mark-rest" data-date="${date}">Rest day</button>
      <button class="btn btn--primary btn--sm" data-action="log-on" data-date="${date}">I trained · log it</button>
    </div>
  </section>`;
}

/** Done workouts this week (Mon–Sun) vs the weekly goal, plus the current streak. */
export function habitCard(): string {
  const today = todayISO();
  const week = weekDates(today);
  const done = sessionsSorted().filter((s) => s.status === "done");
  const trainedDays = new Set(done.map((s) => s.date));
  const thisWeek = done.filter((s) => s.date >= week[0]! && s.date <= week[6]!).length;
  const active = new Set(trainedDays);
  for (const r of Object.values(store.state.runs)) for (const d of Object.values(r.days)) if (d.status === "done") active.add(d.date);
  for (const [d, m] of Object.entries(store.state.marks)) if (m === "rest") active.add(d);
  const st = streak(active, today);
  const goal = store.state.settings.weeklyGoal;
  const skipped = new Set(Object.entries(store.state.marks).filter(([, m]) => m === "skipped").map(([d]) => d));
  const dots = week.map((d) => {
    const cls = trainedDays.has(d) ? "is-on" : skipped.has(d) ? "is-skip" : d === today ? "is-today" : d > today ? "is-future" : "";
    const name = new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });
    return `<li class="${cls}"><span class="habit__dot" aria-hidden="true"></span><span class="habit__dow">${esc(name)}</span></li>`;
  }).join("");
  return `<section class="card habit" aria-label="This week: ${thisWeek} of ${goal} workouts. Streak ${st} days.">
    <div class="habit__row">
      <div><p class="label">This week</p><p class="habit__big">${thisWeek}<small>/${goal} workouts</small></p></div>
      <div class="habit__streak"><p class="label">Streak</p><p class="habit__big">${st}<small> day${st === 1 ? "" : "s"}</small></p></div>
    </div>
    <ol class="habit__week" aria-hidden="true">${dots}</ol>
    ${thisWeek >= goal ? `<p class="habit__note">${ICON.check}<span>Weekly goal reached</span></p>` : ""}
  </section>`;
}

export function quoteLine(): string {
  return `<p class="quote-line"><span aria-hidden="true">“</span>${esc(quoteForDate(todayISO()))}<span aria-hidden="true">”</span></p>`;
}

const INSTALL_DISMISSED = "fitnessTracker.installDismissed";

export function installCard(): string {
  const st = installState();
  if (st === "installed" || st === "manual" || readJSON<boolean>(INSTALL_DISMISSED, false)) return "";
  return `<section class="card install-card">
    <span class="install-card__icon" aria-hidden="true">${ICON.download}</span>
    <div class="install-card__text">
      <strong>Install the app</strong>
      <small>${st === "ios" ? "Tap Share, then “Add to Home Screen”. Needed for reminders on iPhone." : "Opens full-screen like a normal app, with reminders."}</small>
    </div>
    ${st === "prompt" ? `<button class="btn btn--primary btn--sm" data-action="install-app">Install</button>` : `<a class="btn btn--ghost btn--sm" href="#/install">How</a>`}
    <button class="icon-btn" data-action="install-dismiss" aria-label="Dismiss">${ICON.close}</button>
  </section>`;
}
export const INSTALL_DISMISSED_KEY = INSTALL_DISMISSED;
