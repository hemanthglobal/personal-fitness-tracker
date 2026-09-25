/* Router, rendering and event delegation. */
import { confirmDialog } from "./components/modal";
import { renderSyncStatus, setActiveNav, type NavKey } from "./components/navigation";
import { toast } from "./components/toast";
import { emptyState, pageHeader } from "./components/ui";
import { sendPasswordReset, signIn, signOut, signUp, updatePassword } from "./lib/auth";
import { changed, currentDay, displayToKg, isDayComplete, normalizeState, setDayComplete, store, unit, type WeightUnit } from "./lib/state";
import { clearAllData, flush, onStatus, replaceWithImport, session, startProgramme } from "./lib/sync";
import { cloudEnabled } from "./lib/supabase";
import { rememberTheme } from "./lib/storage";
import { $, fmtDate, parseISO, todayISO } from "./lib/utils";
import { renderAuth, type AuthScreen } from "./views/auth";
import { renderCalendar, selectCycle } from "./views/calendar";
import { renderMore, renderAbout, renderShopping, renderSupplements } from "./views/more";
import { renderNutrition } from "./views/nutrition";
import { renderOnboarding } from "./views/onboarding";
import { renderProgress } from "./views/progress";
import { renderSettings } from "./views/settings";
import { renderToday } from "./views/today";
import { renderWeight } from "./views/weight";
import { currentWorkout, focusNextField, onNotesInput, onSetInput, refreshActionBar, renderDay, stepField, stopRestTimer, toggleSet } from "./views/workout";

const view = $("#view")!;

/* ---------------------------------------------------------------------------
 * App phase (set by main.ts)
 * ------------------------------------------------------------------------- */

type Phase = "loading" | "auth" | "recovery" | "load-failed" | "app";
let phase: Phase = cloudEnabled ? "loading" : "app";
export const setPhase = (p: Phase) => { phase = p; render(); };
export const getPhase = () => phase;

/* ---------------------------------------------------------------------------
 * Routing
 * ------------------------------------------------------------------------- */

const ROUTES: Record<string, (param?: string) => string> = {
  today: renderToday,
  calendar: renderCalendar,
  day: renderDay,
  progress: renderProgress,
  more: renderMore,
  weight: renderWeight,
  nutrition: renderNutrition,
  shopping: renderShopping,
  supplements: renderSupplements,
  about: renderAbout,
  settings: renderSettings,
};
const MORE_ROUTES = new Set(["more", "weight", "nutrition", "shopping", "supplements", "about", "settings"]);
const AUTH_ROUTES = new Set(["login", "signup", "forgot"]);

function parseRoute() {
  const [name = "", param] = location.hash.replace(/^#\/?/, "").split("/");
  return { name: name || "today", param };
}

export function applyTheme() {
  const t = store.state.settings.theme;
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  rememberTheme(t);
}

export function render({ keepScroll = false } = {}) {
  stopRestTimer();
  const { name, param } = parseRoute();
  let html: string;
  let nav: NavKey | null = null;
  let chrome = false;

  if (phase === "loading") {
    html = `<div class="loader" role="status"><span class="brand-mark brand-mark--lg">60</span><span class="sr-only">Loading</span></div>`;
  } else if (phase === "auth") {
    html = renderAuth((AUTH_ROUTES.has(name) ? name : "login") as AuthScreen);
  } else if (phase === "recovery") {
    html = renderAuth("reset");
  } else if (phase === "load-failed") {
    html = `${pageHeader("Can't load your data")}
      ${emptyState("We couldn't reach the server.", "Check your connection. Nothing has been lost.", '<button class="btn btn--primary" data-action="retry-load">Try again</button>')}`;
  } else if (!store.state.onboarded) {
    html = renderOnboarding();
  } else {
    chrome = true;
    const route = ROUTES[name] ?? renderToday;
    try {
      html = route(param);
    } catch (err) {
      console.error(err);
      html = `${pageHeader("Something went wrong")}${emptyState("This screen couldn't be displayed.", "Try going back to Today.", '<a class="btn btn--primary" href="#/today">Back to Today</a>')}`;
    }
    nav = name === "day" ? (Number(param) === currentDay() ? "today" : "calendar")
      : MORE_ROUTES.has(name) ? "more"
      : (["today", "calendar", "progress"].includes(name) ? name : "today") as NavKey;
  }

  view.innerHTML = html;
  view.classList.remove("is-entering");
  void view.offsetWidth;
  view.classList.add("is-entering");
  document.body.classList.toggle("is-bare", !chrome);
  document.body.classList.toggle("has-actionbar", !!$("#actionbar", view));
  setActiveNav(nav);
  const h1 = $("h1", view);
  document.title = `${h1 ? (h1 as HTMLElement).innerText.replace(/\s+/g, " ").trim() : "60 Days"} · 60 Days Tracker`;
  if (!keepScroll) window.scrollTo(0, 0);
}

window.addEventListener("hashchange", () => {
  render();
  $("#main")?.focus({ preventScroll: true });
});

/* ---------------------------------------------------------------------------
 * Actions
 * ------------------------------------------------------------------------- */

async function guarded(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    toast(err instanceof Error ? err.message : "Something went wrong.", "error");
  }
}

const Actions: Record<string, (el: HTMLElement) => void | Promise<void>> = {
  "toggle-set": toggleSet,
  step: stepField,
  "stop-timer": () => { stopRestTimer(); refreshActionBar(); },

  "complete-workout": () => {
    const sched = currentWorkout();
    if (!sched) return;
    stopRestTimer();
    setDayComplete(sched.day, true);
    toast(`Day ${sched.day} complete`);
    location.hash = sched.day === currentDay() ? "#/today" : "#/calendar";
  },
  "uncomplete-workout": () => {
    const sched = currentWorkout();
    if (!sched) return;
    setDayComplete(sched.day, false);
    toast(`Day ${sched.day} marked not done`);
    render({ keepScroll: true });
  },
  "toggle-rest": (btn) => {
    const day = Number(btn.dataset.day);
    const next = !isDayComplete(day);
    setDayComplete(day, next);
    toast(next ? "Rest day complete" : "Rest day unmarked");
    render({ keepScroll: true });
  },
  cycle: (btn) => {
    selectCycle(Number(btn.dataset.cycle));
    render({ keepScroll: true });
    $(`#cycle-tab-${btn.dataset.cycle}`)?.focus();
  },

  "start-again": () => guarded(async () => {
    const ok = await confirmDialog({
      title: "Start the programme again?",
      body: "Your finished programme is kept in your history, and today becomes the new Day 1. Body weight entries are kept.",
      confirmLabel: "Start again",
    });
    if (!ok) return;
    await startProgramme(todayISO(), unit(), "completed");
    selectCycle(null);
    toast("New programme started");
    render();
  }),
  reset: () => guarded(async () => {
    const ok = await confirmDialog({
      title: "Reset your programme?",
      body: "This will remove your current progress and workout logs. Settings and body weight entries are kept.",
      confirmLabel: "Reset",
      danger: true,
    });
    if (!ok) return;
    await startProgramme(store.state.settings.startDate, unit(), "cancelled");
    selectCycle(null);
    toast("Programme reset");
  }),
  "clear-all": () => guarded(async () => {
    const ok = await confirmDialog({
      title: "Clear all data?",
      body: `All programmes, workout logs and body weight entries will be permanently deleted${cloudEnabled ? " from your account" : " from this browser"}. Export a copy first if you might want it.`,
      confirmLabel: "Delete everything",
      danger: true,
    });
    if (!ok) return;
    await clearAllData();
    selectCycle(null);
    applyTheme();
    location.hash = "#/today";
    render();
    toast("All data cleared");
  }),
  "sign-out": () => guarded(async () => {
    if (session.pending) {
      const ok = await confirmDialog({
        title: "Log out with unsynced changes?",
        body: `${session.pending} change(s) haven't reached the server yet and will be lost if you log out now. Reconnect first to keep them.`,
        confirmLabel: "Log out anyway",
        danger: true,
      });
      if (!ok) return;
    }
    await signOut(); // the SIGNED_OUT event clears state and shows the login screen
  }),
  "retry-load": () => { location.reload(); },

  export: () => {
    const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `fitness-tracker-backup-${todayISO()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Data exported");
  },
  "clear-shopping": () => {
    store.state.shopping = {};
    changed("local");
    render({ keepScroll: true });
  },
  "delete-weight": (btn) => guarded(async () => {
    const date = btn.dataset.date!;
    const ok = await confirmDialog({ title: "Delete this entry?", body: `Body weight for ${fmtDate(date)} will be removed.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    store.state.bodyWeight = store.state.bodyWeight.filter((e) => e.date !== date);
    changed(`bw:${date}`);
    toast("Entry deleted");
    render({ keepScroll: true });
  }),
};

view.addEventListener("click", (e) => {
  const video = (e.target as Element).closest("a[data-video]");
  if (video && !navigator.onLine) {
    e.preventDefault();
    toast("Video unavailable offline. Reconnect to view the exercise demo.", "error");
    return;
  }
  const el = (e.target as Element).closest<HTMLElement>("[data-action]");
  if (!el || !view.contains(el)) return;
  const fn = Actions[el.dataset.action!];
  if (fn) { e.preventDefault(); void fn(el); }
});

$("#sync-status")?.addEventListener("click", () => void flush());

view.addEventListener("input", (e) => {
  const t = e.target as HTMLElement;
  if (t.matches(".stepper__input")) onSetInput(t as HTMLInputElement);
  else if (t.matches('textarea[data-field="notes"]')) onNotesInput(t as HTMLTextAreaElement);
});

view.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  if (e.key === "Enter" && t.matches(".stepper__input")) { e.preventDefault(); focusNextField(t as HTMLInputElement); }
  // Arrow keys move between cycle tabs (tablist pattern).
  if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && t.matches(".cycle-tab")) {
    const c = Number(t.dataset.cycle) + (e.key === "ArrowRight" ? 1 : -1);
    if (c >= 1 && c <= 5) { selectCycle(c); render({ keepScroll: true }); $(`#cycle-tab-${c}`)?.focus(); }
  }
});

// Select the whole value on focus so typing replaces it.
view.addEventListener("focusin", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.matches?.(".stepper__input")) setTimeout(() => t.select(), 0);
});

view.addEventListener("change", (e) => void onChangeEvent(e.target as HTMLInputElement));

async function onChangeEvent(t: HTMLInputElement) {
  if (t.dataset.shop) {
    if (t.checked) store.state.shopping[t.dataset.shop] = true;
    else delete store.state.shopping[t.dataset.shop];
    changed("local");
    const c = $("#shop-count");
    if (c) c.textContent = `${Object.keys(store.state.shopping).length} ticked`;
    return;
  }

  const setting = t.dataset.setting;
  if (setting === "startDate") {
    const err = $("#set-start-err")!;
    const valid = !!parseISO(t.value);
    err.textContent = valid ? "" : "Enter a valid date.";
    err.hidden = valid;
    t.setAttribute("aria-invalid", String(!valid));
    if (!valid) return;
    store.state.settings.startDate = t.value;
    selectCycle(null);
    changed("settings");
    toast(`Day 1 is now ${fmtDate(t.value)}`);
    return;
  }
  if (setting === "weightUnit") {
    store.state.settings.weightUnit = t.value as WeightUnit;
    changed("profile");
    toast(`Showing weights in ${t.value}`);
    return;
  }
  if (setting === "theme") {
    store.state.settings.theme = t.value as "system" | "light" | "dark";
    changed("local");
    applyTheme();
    return;
  }

  if (t.dataset.change === "import" && t.files?.[0]) {
    const err = $("#import-err")!;
    err.hidden = true;
    const file = t.files[0];
    t.value = "";
    let next;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("big");
      next = normalizeState(JSON.parse(await file.text()));
      next.onboarded = true;
    } catch {
      err.textContent = "Couldn't import that file. It doesn't look like a valid fitness tracker backup.";
      err.hidden = false;
      toast("Import failed", "error");
      return;
    }
    const ok = await confirmDialog({
      title: "Replace your current data?",
      body: `This file has ${Object.values(next.days).filter((d) => d.completed).length} completed days, starting ${fmtDate(next.settings.startDate)}. Your current programme and body weight entries will be replaced.`,
      confirmLabel: "Replace",
      danger: true,
    });
    if (!ok) return;
    await guarded(async () => {
      await replaceWithImport(next);
      applyTheme();
      selectCycle(null);
      toast("Import successful");
      location.hash = "#/today";
    });
  }
}

/* ---------------------------------------------------------------------------
 * Forms
 * ------------------------------------------------------------------------- */

function formError(msg: string, focus?: HTMLElement | null) {
  const err = $("#auth-err") ?? $("#ob-err") ?? $("#bw-err");
  if (err) { err.textContent = msg; err.hidden = !msg; }
  if (msg && focus) { focus.setAttribute("aria-invalid", "true"); focus.focus(); }
}

function setBusy(form: HTMLFormElement, busy: boolean) {
  const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!btn) return;
  btn.disabled = busy;
  btn.classList.toggle("is-busy", busy);
}

const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

view.addEventListener("submit", (e) => {
  e.preventDefault();
  void onSubmit(e.target as HTMLFormElement);
});

async function onSubmit(form: HTMLFormElement) {
  const kind = form.dataset.form;
  const val = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value.trim() ?? "";
  const el = (n: string) => form.elements.namedItem(n) as HTMLInputElement | null;
  formError("");

  if (kind === "login" || kind === "signup" || kind === "forgot") {
    const email = val("email");
    if (!validEmail(email)) return formError("Enter a valid email address.", el("email"));
    const password = val("password");
    if (kind !== "forgot" && password.length < (kind === "signup" ? 8 : 1)) {
      return formError(kind === "signup" ? "Password must be at least 8 characters." : "Enter your password.", el("password"));
    }
    setBusy(form, true);
    try {
      if (kind === "login") {
        await signIn(email, password); // SIGNED_IN event loads the app
      } else if (kind === "signup") {
        const needsConfirm = await signUp(email, password);
        if (needsConfirm) showOk("Check your email to confirm your account, then log in.");
      } else {
        await sendPasswordReset(email);
        showOk("If an account exists for that email, a reset link is on its way.");
      }
    } catch (err) {
      formError((err as Error).message);
    } finally {
      setBusy(form, false);
    }
    return;
  }

  if (kind === "reset") {
    const password = val("password");
    if (password.length < 8) return formError("Password must be at least 8 characters.", el("password"));
    setBusy(form, true);
    try {
      await updatePassword(password);
      toast("Password updated");
      history.replaceState(null, "", "#/today");
      setPhase(store.state.onboarded || session.userId ? "app" : "auth");
    } catch (err) {
      formError((err as Error).message);
    } finally {
      setBusy(form, false);
    }
    return;
  }

  if (kind === "onboard") {
    const date = val("startDate");
    if (!parseISO(date)) return formError("Choose a valid start date.", el("startDate"));
    const u = (form.elements.namedItem("unit") as RadioNodeList).value === "lb" ? "lb" : "kg";
    setBusy(form, true);
    try {
      await startProgramme(date, u);
      location.hash = "#/today";
      render();
      toast("Programme set. Let's go.");
    } catch (err) {
      formError((err as Error).message);
      setBusy(form, false);
    }
    return;
  }

  if (kind === "weight") {
    const date = val("date");
    const raw = val("weight").replace(",", ".");
    const v = Number(raw);
    const max = unit() === "kg" ? 500 : 1100;
    if (!parseISO(date)) return formError("Choose a valid date.", el("date"));
    if (!raw || !Number.isFinite(v) || v <= 0 || v > max) return formError(`Enter a weight between 0 and ${max} ${unit()}.`, el("weight"));
    const entry = { date, weight: displayToKg(v), notes: val("notes").slice(0, 500) };
    const i = store.state.bodyWeight.findIndex((x) => x.date === date);
    if (i >= 0) store.state.bodyWeight[i] = entry;
    else store.state.bodyWeight.push(entry);
    changed(`bw:${date}`);
    toast(i >= 0 ? "Entry updated" : "Weight logged");
    render({ keepScroll: true });
  }
}

function showOk(msg: string) {
  const ok = $("#auth-ok");
  if (ok) { ok.textContent = msg; ok.hidden = false; }
}

/* ---------------------------------------------------------------------------
 * Sync status + problems
 * ------------------------------------------------------------------------- */

onStatus(renderSyncStatus);

