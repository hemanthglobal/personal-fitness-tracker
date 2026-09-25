/*
 * Local cache (localStorage). In cloud mode this is an offline/UX layer; Supabase is the
 * source of truth. In local-only mode (no Supabase env vars) it is the only store.
 * Not a security boundary.
 */
import { normalizeState, type AppState } from "./state";

const BASE = "fitnessTracker";

/** Separate namespace per user so one account never sees another's cached data. */
export const cacheKey = (userId: string | null) => (userId ? `${BASE}:${userId}` : BASE);

export function loadCache(key: string): { state: AppState | null; error?: string } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return { state: null, error: "Browser storage is blocked, so data can't be kept on this device." };
  }
  if (raw == null) return { state: null };
  try {
    return { state: normalizeState(JSON.parse(raw)) };
  } catch {
    try { localStorage.setItem(`${key}.unreadable-${Date.now()}`, raw); } catch { /* ignore */ }
    return { state: null, error: "Saved data on this device couldn't be read, so it was set aside and the app started fresh." };
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Remove the cache, queue and metadata for one namespace. */
export function clearNamespace(key: string) {
  try {
    for (const k of Object.keys(localStorage)) if (k === key || k.startsWith(`${key}.`)) localStorage.removeItem(k);
  } catch { /* ignore */ }
}

/** Theme is read before first paint, so keep a copy outside the per-user namespace. */
export function rememberTheme(theme: string) {
  try { localStorage.setItem(`${BASE}.theme`, theme); } catch { /* ignore */ }
}
