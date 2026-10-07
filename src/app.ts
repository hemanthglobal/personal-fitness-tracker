/* Router, rendering and event delegation. */
import { BUILTIN_60, pplTemplate, programRef } from "./data/programs";
import { confirmDialog } from "./components/modal";
import { renderSyncStatus, setActiveNav, type NavKey } from "./components/navigation";
import { toast } from "./components/toast";
import { emptyState, pageHeader } from "./components/ui";
import { sendPasswordReset, signIn, signOut, signUp, updatePassword } from "./lib/auth";
import {
  activeRun, changed, completeSession, createSession, deleteSession, displayToKg, endRun, normalizeState, setRestDay, startRun,
  store, unit, uuid, type WeightUnit,
} from "./lib/state";
import { clearAllData, flush, onStatus, replaceWithImport, session } from "./lib/sync";
import { cloudEnabled } from "./lib/supabase";
import { rememberTheme } from "./lib/storage";
import { $, fmtDate, parseISO, todayISO } from "./lib/utils";
import { renderAuth, type AuthScreen } from "./views/auth";
import { calendarAction, renderCalendar, resetCalendar } from "./views/calendar";
import { selectCycle } from "./views/plan";
import { renderMore, renderAbout, renderShopping, renderSupplements } from "./views/more";
import { renderNutrition } from "./views/nutrition";
import { renderOnboarding } from "./views/onboarding";
import { renderProgress } from "./views/progress";
import {
  builderAction, builderDeleteTarget, builderInput, builderSave, discardDraft, renderBuilder, renderProgramStart, renderPrograms,
} from "./views/programs";
import { renderSettings } from "./views/settings";
import { renderToday } from "./views/today";
import { renderWeight } from "./views/weight";
import { renderRoutines, renderSession, sessionControl, startSession, stopSession } from "./views/session";
import {
  addExercise, addSet, currentWorkout, ensureSession, focusNextField, onNotesInput, onSessionDate, onSetInput, refreshActionBar,
  removeExercise, renderDay, renderLog, renderSwap, stepField, stopRestTimer, toggleSet,
} from "./views/workout";

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

const ROUTES: Record<string, (param?: string, ...rest: string[]) => string> = {
  today: renderToday,
  calendar: renderCalendar,
  day: renderDay,
  log: renderLog,
  swap: renderSwap,
  progress: renderProgress,
  more: renderMore,
  programs: renderPrograms,
  program: (mode, ...rest) => (mode === "start" ? renderProgramStart(...(rest as [string])) : renderBuilder(mode, rest[0])),
  weight: renderWeight,
  nutrition: renderNutrition,
  shopping: renderShopping,
  supplements: renderSupplements,
  about: renderAbout,
  settings: renderSettings,
  routines: renderRoutines,
  session: renderSession,
};
const NAV_OF: Record<string, NavKey> = {
  today: "today", day: "today", swap: "today", calendar: "calendar", log: "calendar", progress: "progress",
};
const AUTH_ROUTES = new Set(["login", "signup", "forgot"]);

function parseRoute() {
  const [name = "", param, ...rest] = location.hash.replace(/^#\/?/, "").split("/");
  return { name: name || "today", param, rest };
}

export function applyTheme() {
  const t = store.state.settings.theme;
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  rememberTheme(t);
}

export function render({ keepScroll = false } = {}) {
  stopRestTimer();
  stopSession();
  const { name, param, rest } = parseRoute();
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
    if (name !== "program") discardDraft();
    const route = ROUTES[name] ?? renderToday;
    try {
      html = route(param, ...rest);
    } catch (err) {
      console.error(err);
      html = `${pageHeader("Something went wrong")}${emptyState("This screen couldn't be displayed.", "Try going back to Today.", '<a class="btn btn--primary" href="#/today">Back to Today</a>')}`;
    }
    nav = NAV_OF[name] ?? (ROUTES[name] ? "more" : "today");
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

const rerender = () => render({ keepScroll: true });
const resetViews = () => { selectCycle(null); resetCalendar(); };

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
  /* ---- logging ---- */
  "toggle-set": toggleSet,
  step: stepField,
  "add-set": (btn) => { addSet(btn); rerender(); },
  "remove-exercise": (btn) => { removeExercise(btn); rerender(); },
  "stop-timer": () => { stopRestTimer(); refreshActionBar(); },

  "complete-workout": () => {
    const w = currentWorkout();
    if (!w) return;
    stopRestTimer();
    const s = ensureSession(w);
    completeSession(s, true);
    toast(s.day ? `Day ${s.day} done` : "Workout logged");
    location.hash = s.runId && s.runId === store.state.activeRunId ? "#/today" : "#/calendar";
  },
  "uncomplete-workout": () => {
    const w = currentWorkout();
    if (!w?.session) return;
    completeSession(w.session, false);
    toast("Marked not done");
    rerender();
  },
  "delete-session": (btn) => guarded(async () => {
    const w = currentWorkout();
    if (!w?.session) return;
    const ok = await confirmDialog({ title: "Delete this workout log?", body: "The sets and notes logged in this workout will be removed. If it counted as a program day, that day becomes undone.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    deleteSession(w.session);
    toast("Workout log deleted");
    void btn;
    location.hash = "#/calendar";
  }),
  "free-workout": (btn) => {
    const date = btn.dataset.date && btn.dataset.date <= todayISO() ? btn.dataset.date : todayISO();
    const s = createSession({ runId: null, day: null, workoutKey: null, title: "Free workout", plan: [], date });
    location.hash = `#/log/${s.id}`;
  },

  /* ---- rest days ---- */
  "rest-done": (btn) => { const run = activeRun(); if (!run) return; setRestDay(run, Number(btn.dataset.day), "done"); toast("Rest day complete"); rerender(); },
  "rest-skip": (btn) => {
    const run = activeRun(); if (!run) return;
    setRestDay(run, Number(btn.dataset.day), "skipped");
    toast("Rest day skipped. Here's your next workout");
    if (location.hash === "#/today" || location.hash === "") rerender(); else location.hash = "#/today";
  },
  "rest-undo": (btn) => { const run = activeRun(); if (!run) return; setRestDay(run, Number(btn.dataset.day), null); toast("Rest day undone"); rerender(); },

  /* ---- calendar / plan ---- */
  "month-prev": (btn) => { calendarAction(btn.dataset.action!); rerender(); },
  "month-next": (btn) => { calendarAction(btn.dataset.action!); rerender(); },
  "month-today": (btn) => { calendarAction(btn.dataset.action!); rerender(); },
  "pick-date": (btn) => { calendarAction("pick-date", btn.dataset.date); rerender(); $(`[data-date="${btn.dataset.date}"]`)?.focus(); },
  cycle: (btn) => { selectCycle(Number(btn.dataset.cycle)); rerender(); $(`#cycle-tab-${btn.dataset.cycle}`)?.focus(); },

  /* ---- warm-up / stretch timers ---- */
  "session-start": () => startSession(),
  "session-restart": () => startSession(),
  "session-pause": () => sessionControl("pause"),
  "session-next": () => sessionControl("next"),
  "session-prev": () => sessionControl("prev"),
  "session-sound": () => sessionControl("sound"),

  /* ---- programs ---- */
  "end-run": () => guarded(async () => {
    const run = activeRun();
    if (!run) return;
    const ok = await confirmDialog({ title: `End ${run.name}?`, body: "It moves to your history with everything you logged. You can start any program afterwards.", confirmLabel: "End program", danger: true });
    if (!ok) return;
    endRun(run);
    resetViews();
    toast("Program ended");
    rerender();
  }),
  "restart-run": () => guarded(async () => {
    const run = activeRun();
    if (!run) { toast("No program is running.", "error"); return; }
    const ok = await confirmDialog({ title: `Restart ${run.name}?`, body: "You'll start again from Day 1 today. The current run moves to your history with everything you logged.", confirmLabel: "Restart", danger: true });
    if (!ok) return;
    startRun(run.programRef, todayISO());
    resetViews();
    toast("Program restarted");
    location.hash = "#/today";
  }),
  "b-save": () => {
    const res = builderSave();
    const err = $("#b-err");
    if ("error" in res) {
      if (err) { err.textContent = res.error; err.hidden = false; }
      toast(res.error, "error");
      return;
    }
    toast(res.isNew ? "Program saved" : "Changes saved");
    location.hash = res.isNew ? `#/program/start/${programRef(res.id)}` : "#/programs";
  },
  "b-delete": () => guarded(async () => {
    const id = builderDeleteTarget();
    if (!id) return;
    const run = activeRun();
    if (run?.programRef === programRef(id) && run.status === "active") {
      toast("End this program before deleting it.", "error");
      return;
    }
    const ok = await confirmDialog({ title: "Delete this program?", body: "Past runs and logged workouts stay in your history.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    delete store.state.programs[id];
    changed(`program:${id}`);
    discardDraft();
    toast("Program deleted");
    location.hash = "#/programs";
  }),

  /* ---- account / data ---- */
  "start-again": () => { location.hash = "#/programs"; },
  "clear-all": () => guarded(async () => {
    const ok = await confirmDialog({
      title: "Clear all data?",
      body: `All programs, workout logs and body weight entries will be permanently deleted${cloudEnabled ? " from your account" : " from this browser"}. Export a copy first if you might want it.`,
      confirmLabel: "Delete everything",
      danger: true,
    });
    if (!ok) return;
    await clearAllData();
    resetViews();
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
    rerender();
  },
  "delete-weight": (btn) => guarded(async () => {
    const date = btn.dataset.date!;
    const ok = await confirmDialog({ title: "Delete this entry?", body: `Body weight for ${fmtDate(date)} will be removed.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    store.state.bodyWeight = store.state.bodyWeight.filter((e) => e.date !== date);
    changed(`bw:${date}`);
    toast("Entry deleted");
    rerender();
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
  const action = el.dataset.action!;
  if (action.startsWith("b-") && action !== "b-save" && action !== "b-delete") {
    e.preventDefault();
    if (builderAction(action, el)) rerender();
    return;
  }
  const fn = Actions[action];
  if (fn) { e.preventDefault(); void fn(el); }
});

$("#sync-status")?.addEventListener("click", () => void flush());

view.addEventListener("input", (e) => {
  const t = e.target as HTMLElement;
  if (t.matches(".stepper__input")) onSetInput(t as HTMLInputElement);
  else if (t.matches('textarea[data-field="notes"]')) onNotesInput(t as HTMLTextAreaElement);
  else if (t.dataset.b) builderInput(t as HTMLInputElement);
});

view.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  if (e.key === "Enter" && t.matches(".stepper__input")) { e.preventDefault(); focusNextField(t as HTMLInputElement); }
  // Arrow keys move between cycle tabs (tablist pattern).
  if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && t.matches(".cycle-tab")) {
    const max = Number(t.closest<HTMLElement>(".cycle-tabs")?.dataset.cycles ?? 5);
    const c = Number(t.dataset.cycle) + (e.key === "ArrowRight" ? 1 : -1);
    if (c >= 1 && c <= max) { selectCycle(c); rerender(); $(`#cycle-tab-${c}`)?.focus(); }
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
  if (t.dataset.b) { builderInput(t); if (t.dataset.b === "lenmode" || t.dataset.b === "repeats" || t.dataset.b === "pattern") rerender(); return; }
  if (t.dataset.change === "session-date") { onSessionDate(t); return; }

  const setting = t.dataset.setting;
  if (setting === "weightUnit") {
    store.state.settings.weightUnit = t.value as WeightUnit;
    changed("profile");
    toast(`Showing weights in ${t.value}`);
    return;
  }
  if (setting === "sound") {
    store.state.settings.sound = t.value === "on";
    changed("local");
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
    const n = Object.values(next.sessions).filter((s) => s.status === "done").length;
    const ok = await confirmDialog({
      title: "Replace your current data?",
      body: `This file has ${n} logged workouts and ${Object.keys(next.runs).length} program run(s). Your current programs, logs and body weight entries will be replaced.`,
      confirmLabel: "Replace",
      danger: true,
    });
    if (!ok) return;
    replaceWithImport(next);
    applyTheme();
    resetViews();
    toast("Import successful");
    location.hash = "#/today";
  }
}

/* ---------------------------------------------------------------------------
 * Forms
 * ------------------------------------------------------------------------- */

function formError(msg: string, focus?: HTMLElement | null) {
  const err = $("#auth-err") ?? $("#ob-err") ?? $("#bw-err") ?? $("#sp-err") ?? $("#ax-err");
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
    const choice = (form.elements.namedItem("program") as RadioNodeList).value;
    if (choice !== "none" && !parseISO(date)) return formError("Choose a valid start date.", el("startDate"));
    store.state.settings.weightUnit = (form.elements.namedItem("unit") as RadioNodeList).value === "lb" ? "lb" : "kg";
    changed("profile");
    if (choice === "builtin") startRun(BUILTIN_60, date);
    else if (choice === "template") {
      const id = uuid();
      const now = new Date().toISOString();
      store.state.programs[id] = { ...pplTemplate(), id, createdAt: now, updatedAt: now };
      changed(`program:${id}`);
      startRun(programRef(id), date);
    }
    store.state.onboarded = true;
    changed("local");
    location.hash = "#/today";
    render();
    toast(choice === "none" ? "All set. Log a free workout any time." : "Program started. Let's go.");
    return;
  }

  if (kind === "start-program") {
    const date = val("startDate");
    if (!parseISO(date)) return formError("Choose a valid start date.", el("startDate"));
    const ref = form.dataset.ref!;
    startRun(ref, date);
    resetViews();
    toast("Program started");
    location.hash = "#/today";
    return;
  }

  if (kind === "add-exercise") {
    const error = addExercise(form);
    if (error) return formError(error);
    toast("Exercise added");
    rerender();
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
    rerender();
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
