/*
 * Local-first sync.
 *
 *   user change -> store.state updated + UI updated immediately
 *               -> local cache written (survives refresh / offline)
 *               -> object key queued in an outbox (persisted): run:<id>, session:<id>, program:<id>, bw:<date>, profile
 *               -> outbox flushed to Supabase when online (debounced, retried with backoff)
 *
 * Each queued key uploads the whole current object (or deletes it if it no longer exists), so
 * the last write wins. Ids are generated on the device, so everything works offline, including
 * starting a program or logging a free workout.
 */
import { DbError, deleteAllUserData, fetchSnapshot, pushBodyWeight, pushProfile, pushProgram, pushRun, pushSession } from "./database";
import { defaultState, onChange, store, type AppState, type ChangeKey } from "./state";
import { cacheKey, clearNamespace, loadCache, readJSON, rememberTheme, writeJSON } from "./storage";
import { cloudEnabled } from "./supabase";

export type SyncStatus = "local" | "synced" | "saving" | "offline" | "error";

const ctx = {
  userId: null as string | null,
  email: "",
  key: cacheKey(null),
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
 * Status + problems
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
  ctx.queue = readJSON<ChangeKey[]>(`${ctx.key}.queue`, []).filter((k) => typeof k === "string" && !/^(day:|settings$)/.test(k));
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
  ctx.queue = [];
  ctx.key = cacheKey(null);
  store.state = defaultState();
  setStatus("synced");
}

/** Copy one queued object from `from` into `to` (or delete it there). */
function carry(key: ChangeKey, from: AppState, to: AppState) {
  const [kind, id = ""] = key.split(/:(.*)/s) as [string, string];
  if (kind === "run") { if (from.runs[id]) to.runs[id] = from.runs[id]!; else delete to.runs[id]; }
  else if (kind === "session") { if (from.sessions[id]) to.sessions[id] = from.sessions[id]!; else delete to.sessions[id]; }
  else if (kind === "program") { if (from.programs[id]) to.programs[id] = from.programs[id]!; else delete to.programs[id]; }
  else if (kind === "bw") {
    to.bodyWeight = to.bodyWeight.filter((e) => e.date !== id);
    const mine = from.bodyWeight.find((e) => e.date === id);
    if (mine) to.bodyWeight.push(mine);
  } else if (key === "profile") to.settings.weightUnit = from.settings.weightUnit;
}

const pickActive = (s: AppState) =>
  Object.values(s.runs).filter((r) => r.status === "active").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id ?? null;

/**
 * Pull the latest from Supabase and merge in changes still waiting in the outbox
 * (local wins for those objects). Returns true if the visible state changed.
 */
export async function pull(): Promise<boolean> {
  if (!ctx.userId) return false;
  const before = JSON.stringify(store.state);
  const local = store.state;
  const next = await fetchSnapshot(ctx.userId);
  next.settings.theme = local.settings.theme;
  next.settings.sound = local.settings.sound;
  next.shopping = local.shopping;
  for (const key of ctx.queue) carry(key, local, next);
  next.activeRunId = pickActive(next);
  next.onboarded = next.onboarded || local.onboarded;

  store.state = next;
  persistQueue();
  persistCacheNow();
  scheduleFlush(0);
  if (!ctx.queue.length) setStatus("synced");
  return JSON.stringify(next) !== before;
}

/* ---------------------------------------------------------------------------
 * Outbox
 * ------------------------------------------------------------------------- */

const SYNCABLE = (k: ChangeKey) => k !== "local";

function enqueue(key: ChangeKey) {
  if (!ctx.queue.includes(key)) ctx.queue.push(key);
}

onChange((key) => {
  persistCacheSoon();
  if (!cloudEnabled || !ctx.userId || !SYNCABLE(key)) return;
  enqueue(key);
  persistQueue();
  setStatus(navigator.onLine ? "saving" : "offline");
  scheduleFlush(key.startsWith("session:") ? 700 : 250);
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
  err instanceof DbError && !!err.code && (/^2[23]/.test(err.code) || err.code === "42501");

/**
 * Push order matters for foreign keys: programs → runs → sessions → the rest.
 * Run deletions go before run upserts (the database allows one active run per user).
 * Array.sort is stable, so an ended run is still pushed before the run that replaced it.
 */
function rank(k: ChangeKey): number {
  if (k.startsWith("program:")) return 0;
  if (k.startsWith("run:")) return store.state.runs[k.slice(4)] ? 2 : 1;
  if (k.startsWith("session:")) return 3;
  return 4;
}

export async function flush(): Promise<void> {
  if (!cloudEnabled || !ctx.userId) return;
  if (flushing) { again = true; return; }
  if (!ctx.queue.length) { setStatus("synced"); return; }
  if (!navigator.onLine) { setStatus("offline"); return; }

  flushing = true;
  setStatus("saving");
  const userId = ctx.userId;
  try {
    ctx.queue.sort((a, b) => rank(a) - rank(b));
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
  const [kind, id = ""] = key.split(/:(.*)/s) as [string, string];
  if (kind === "program") return pushProgram(userId, id, s.programs[id] ?? null);
  if (kind === "run") return pushRun(userId, id, s.runs[id] ?? null);
  if (kind === "session") return pushSession(userId, id, s.sessions[id] ?? null);
  if (kind === "bw") return pushBodyWeight(userId, id, s.bodyWeight.find((e) => e.date === id) ?? null);
  if (key === "profile") return pushProfile(userId, s.settings.weightUnit);
}

window.addEventListener("online", () => { backoff = 0; scheduleFlush(0); });
window.addEventListener("offline", () => { if (ctx.userId) setStatus("offline"); });

/* ---------------------------------------------------------------------------
 * Whole-account actions
 * ------------------------------------------------------------------------- */

/** Delete everything for this user (cloud rows + local cache) and return to setup. */
export async function clearAllData() {
  if (cloudEnabled && ctx.userId) {
    if (!navigator.onLine) throw new Error("You're offline. Connect to the internet to do this.");
    try {
      await deleteAllUserData();
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      throw new Error("Couldn't reach the server. Nothing was changed. Try again.");
    }
    ctx.queue = [];
  }
  const { theme, sound } = store.state.settings;
  clearNamespace(ctx.key);
  store.state = defaultState();
  store.state.settings.theme = theme;
  store.state.settings.sound = sound;
  persistCacheNow();
  persistQueue();
}

/** Replace current data with an imported backup (old objects are deleted on the server). */
export function replaceWithImport(next: AppState) {
  const prev = store.state;
  next.settings.theme = prev.settings.theme;
  next.settings.sound = prev.settings.sound;
  store.state = next;
  if (cloudEnabled && ctx.userId) {
    const keys = new Set<ChangeKey>(["profile"]);
    for (const id of new Set([...Object.keys(prev.programs), ...Object.keys(next.programs)])) keys.add(`program:${id}`);
    for (const id of new Set([...Object.keys(prev.runs), ...Object.keys(next.runs)])) keys.add(`run:${id}`);
    for (const id of new Set([...Object.keys(prev.sessions), ...Object.keys(next.sessions)])) keys.add(`session:${id}`);
    for (const d of new Set([...prev.bodyWeight, ...next.bodyWeight].map((e) => e.date))) keys.add(`bw:${d}`);
    // Deletes of old runs must happen before new runs are inserted (one active run per user).
    ctx.queue = [...keys];
    persistQueue();
    scheduleFlush(0);
  }
  persistCacheNow();
}
