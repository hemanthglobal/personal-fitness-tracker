/*
 * Local-first sync.
 *
 *   user change -> store.state updated + UI updated immediately
 *               -> local cache written (survives refresh / offline)
 *               -> key queued in an outbox (persisted)
 *               -> outbox flushed to Supabase when online (debounced, retried with backoff)
 *
 * Conflicts: each queued key uploads the *whole* current value for that day / date, so the
 * last write wins. No field-level merging (documented in README).
 */
import {
  createProgramme, deleteAllUserData, endProgramme, fetchSnapshot, pushBodyWeight, pushDay, pushProfile, updateStartDate,
  DbError, type RemoteMeta,
} from "./database";
import { changed, defaultState, onChange, store, type AppState, type ChangeKey } from "./state";
import { cacheKey, clearNamespace, loadCache, readJSON, rememberTheme, writeJSON } from "./storage";
import { cloudEnabled } from "./supabase";

export type SyncStatus = "local" | "synced" | "saving" | "offline" | "error";

const ctx = {
  userId: null as string | null,
  email: "",
  key: cacheKey(null),
  meta: null as RemoteMeta | null,
  queue: [] as ChangeKey[],
  status: (cloudEnabled ? "synced" : "local") as SyncStatus,
  lastError: "",
};

export const session = {
  get userId() { return ctx.userId; },
  get email() { return ctx.email; },
  get pending() { return ctx.queue.length; },
  get status() { return ctx.status; },
  get lastError() { return ctx.lastError; },
};

/* ---------------------------------------------------------------------------
 * Status
 * ------------------------------------------------------------------------- */

const statusListeners: ((s: SyncStatus) => void)[] = [];
export const onStatus = (fn: (s: SyncStatus) => void) => { statusListeners.push(fn); fn(ctx.status); };
function setStatus(s: SyncStatus, err = "") {
  ctx.status = s;
  ctx.lastError = err;
  statusListeners.forEach((fn) => fn(s));
}

/** Friendly problems surfaced to the UI (toast). Raw DB errors are only logged in dev. */
const problemListeners: ((msg: string) => void)[] = [];
export const onProblem = (fn: (msg: string) => void) => { problemListeners.push(fn); };
const problem = (msg: string) => problemListeners.forEach((fn) => fn(msg));

/* ---------------------------------------------------------------------------
 * Local cache
 * ------------------------------------------------------------------------- */

let cacheTimer: ReturnType<typeof setTimeout> | undefined;
function persistCacheSoon() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(persistCacheNow, 150);
}
export function persistCacheNow() {
  clearTimeout(cacheTimer);
  if (cloudEnabled && !ctx.userId) return; // signed out: nothing user-specific to keep
  if (!writeJSON(ctx.key, store.state)) problem("Couldn't save on this device. Browser storage may be full or blocked.");
  rememberTheme(store.state.settings.theme);
}
const persistMeta = () => { if (ctx.userId) writeJSON(`${ctx.key}.meta`, ctx.meta); };
const persistQueue = () => { if (ctx.userId) writeJSON(`${ctx.key}.queue`, ctx.queue); };

window.addEventListener("pagehide", () => persistCacheNow());

/* ---------------------------------------------------------------------------
 * Session lifecycle
 * ------------------------------------------------------------------------- */

/** Local-only mode (no Supabase configured). Returns a load error message, if any. */
export function initLocal(): string | undefined {
  ctx.key = cacheKey(null);
  const { state, error } = loadCache(ctx.key);
  store.state = state ?? defaultState();
  setStatus("local");
  return error;
}

/** Signed in: show cached data for this user immediately (if any). Returns true if a cache existed. */
export function initUser(userId: string, email: string): boolean {
  ctx.userId = userId;
  ctx.email = email;
  ctx.key = cacheKey(userId);
  ctx.meta = readJSON<RemoteMeta | null>(`${ctx.key}.meta`, null);
  ctx.queue = readJSON<ChangeKey[]>(`${ctx.key}.queue`, []);
  const { state } = loadCache(ctx.key);
  store.state = state ?? defaultState();
  return !!state;
}

/** Signed out: forget everything user-specific in memory. */
export function endSession({ wipeCache }: { wipeCache: boolean }) {
  clearTimeout(flushTimer);
  clearTimeout(cacheTimer);
  if (wipeCache && ctx.userId) clearNamespace(ctx.key);
  ctx.userId = null;
  ctx.email = "";
  ctx.meta = null;
  ctx.queue = [];
  ctx.key = cacheKey(null);
  store.state = defaultState();
  setStatus("synced");
}

/**
 * Pull the latest from Supabase and merge in any changes still waiting in the outbox
 * (local wins for those keys). Returns true if the visible state changed.
 */
export async function pull(): Promise<boolean> {
  if (!ctx.userId) return false;
  const before = JSON.stringify(store.state);
  const local = store.state;
  const snap = await fetchSnapshot(ctx.userId);
  const next = snap.state;
  next.settings.theme = local.settings.theme;
  next.shopping = local.shopping;

  const sameProgramme = !!snap.meta && ctx.meta?.programmeId === snap.meta.programmeId;
  const keep: ChangeKey[] = [];
  for (const key of ctx.queue) {
    if (key.startsWith("day:")) {
      if (!sameProgramme) continue; // programme was replaced elsewhere; old day edits no longer apply
      const n = Number(key.slice(4));
      if (local.days[n]) next.days[n] = local.days[n]; else delete next.days[n];
      if (local.workouts[n]) next.workouts[n] = local.workouts[n]; else delete next.workouts[n];
    } else if (key.startsWith("bw:")) {
      const date = key.slice(3);
      next.bodyWeight = next.bodyWeight.filter((e) => e.date !== date);
      const mine = local.bodyWeight.find((e) => e.date === date);
      if (mine) next.bodyWeight.push(mine);
    } else if (key === "profile") {
      next.settings.weightUnit = local.settings.weightUnit;
    } else if (key === "settings") {
      if (!sameProgramme) continue;
      next.settings.startDate = local.settings.startDate;
    }
    keep.push(key);
  }
  if (snap.meta && sameProgramme && ctx.meta) {
    // Keep any session ids we learned locally that the snapshot doesn't have yet.
    snap.meta.sessionIds = { ...ctx.meta.sessionIds, ...snap.meta.sessionIds };
  }

  ctx.meta = snap.meta;
  ctx.queue = keep;
  store.state = next;
  persistMeta();
  persistQueue();
  persistCacheNow();
  scheduleFlush(0);
  if (!ctx.queue.length) setStatus("synced");
  return JSON.stringify(next) !== before;
}

/* ---------------------------------------------------------------------------
 * Outbox
 * ------------------------------------------------------------------------- */

const SYNCABLE = (k: ChangeKey) => k.startsWith("day:") || k.startsWith("bw:") || k === "profile" || k === "settings";

onChange((key) => {
  persistCacheSoon();
  if (!cloudEnabled || !ctx.userId || !SYNCABLE(key)) return;
  if (!ctx.queue.includes(key)) ctx.queue.push(key);
  persistQueue();
  setStatus(navigator.onLine ? "saving" : "offline");
  scheduleFlush(key.startsWith("day:") ? 700 : 200);
});

let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;
let again = false;
let backoff = 0;

export function scheduleFlush(delay = 500) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), delay);
}

const isPermanent = (err: unknown) =>
  err instanceof DbError && !!err.code && (/^2[23]/.test(err.code) || err.code === "42501" || err.code === "missing_day");

export async function flush(): Promise<void> {
  if (!cloudEnabled || !ctx.userId) return;
  if (flushing) { again = true; return; }
  if (!ctx.queue.length) { setStatus("synced"); return; }
  if (!navigator.onLine) { setStatus("offline"); return; }
  if (!ctx.meta && ctx.queue.some((k) => k.startsWith("day:") || k === "settings")) {
    // Nothing to attach day edits to yet (e.g. first load still pending). Try a pull first.
    scheduleFlush(3000);
    return;
  }

  flushing = true;
  setStatus("saving");
  const userId = ctx.userId;
  try {
    while (ctx.queue.length && ctx.userId === userId) {
      const key = ctx.queue[0]!;
      try {
        await pushKey(key, userId);
      } catch (err) {
        if (!isPermanent(err)) throw err;
        if (import.meta.env.DEV) console.error("[sync] rejected", key, err);
        problem("Some changes were rejected by the server and couldn't be saved.");
      }
      ctx.queue.shift();
      persistQueue();
      persistMeta();
    }
    backoff = 0;
    setStatus("synced");
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[sync] will retry", err);
    backoff = Math.min(backoff ? backoff * 2 : 5000, 60000);
    setStatus(navigator.onLine ? "error" : "offline", "Couldn't sync. Your changes are saved on this device.");
    scheduleFlush(backoff);
  } finally {
    flushing = false;
    if (again) { again = false; scheduleFlush(0); }
  }
}

async function pushKey(key: ChangeKey, userId: string) {
  const s = store.state;
  if (key.startsWith("day:")) return pushDay(ctx.meta!, userId, Number(key.slice(4)), s);
  if (key.startsWith("bw:")) {
    const date = key.slice(3);
    return pushBodyWeight(userId, date, s.bodyWeight.find((e) => e.date === date) ?? null);
  }
  if (key === "profile") return pushProfile(userId, s.settings.weightUnit);
  if (key === "settings") return updateStartDate(ctx.meta!, userId, s.settings.startDate);
}

window.addEventListener("online", () => { backoff = 0; scheduleFlush(0); });
window.addEventListener("offline", () => { if (ctx.userId) setStatus("offline"); });

/* ---------------------------------------------------------------------------
 * Programme-level actions (need a connection in cloud mode)
 * ------------------------------------------------------------------------- */

function requireOnline() {
  if (!navigator.onLine) throw new Error("You're offline. Connect to the internet to do this.");
}

function friendly(err: unknown): Error {
  if (import.meta.env.DEV) console.error(err);
  if (err instanceof Error && !(err instanceof DbError) && err.message.startsWith("You're offline")) return err;
  return new Error("Couldn't reach the server. Nothing was changed. Try again.");
}

/** First-time setup or a fresh start. Keeps body weight, theme and shopping list. */
export async function startProgramme(startDate: string, weightUnit: "kg" | "lb", endStatus: "completed" | "cancelled" = "cancelled") {
  const s = store.state;
  if (cloudEnabled && ctx.userId) {
    try {
      requireOnline();
      if (ctx.meta) await endProgramme(ctx.meta.programmeId, endStatus);
      ctx.meta = await createProgramme(ctx.userId, startDate);
      if (weightUnit !== s.settings.weightUnit) await pushProfile(ctx.userId, weightUnit);
    } catch (err) {
      throw friendly(err);
    }
    ctx.queue = ctx.queue.filter((k) => k.startsWith("bw:"));
    persistMeta();
    persistQueue();
  }
  s.settings.startDate = startDate;
  s.settings.weightUnit = weightUnit;
  s.days = {};
  s.workouts = {};
  s.onboarded = true;
  changed("local");
  persistCacheNow();
}

/** Delete everything for this user (cloud rows + local cache) and return to setup. */
export async function clearAllData() {
  if (cloudEnabled && ctx.userId) {
    try {
      requireOnline();
      await deleteAllUserData();
    } catch (err) {
      throw friendly(err);
    }
    ctx.meta = null;
    ctx.queue = [];
  }
  const theme = store.state.settings.theme;
  clearNamespace(ctx.key);
  store.state = defaultState();
  store.state.settings.theme = theme;
  persistCacheNow();
  persistMeta();
  persistQueue();
}

/** Replace current data with an imported backup. */
export async function replaceWithImport(next: AppState) {
  const prevDates = store.state.bodyWeight.map((e) => e.date);
  next.settings.theme = store.state.settings.theme;
  if (cloudEnabled && ctx.userId) {
    try {
      requireOnline();
      if (ctx.meta) await endProgramme(ctx.meta.programmeId, "cancelled");
      ctx.meta = await createProgramme(ctx.userId, next.settings.startDate);
    } catch (err) {
      throw friendly(err);
    }
  }
  store.state = next;
  if (cloudEnabled && ctx.userId) {
    const keys = new Set<ChangeKey>(["profile"]);
    for (const n of new Set([...Object.keys(next.days), ...Object.keys(next.workouts)])) keys.add(`day:${Number(n)}`);
    for (const d of new Set([...prevDates, ...next.bodyWeight.map((e) => e.date)])) keys.add(`bw:${d}`);
    ctx.queue = [...keys];
    persistMeta();
    persistQueue();
    scheduleFlush(0);
  }
  persistCacheNow();
}
