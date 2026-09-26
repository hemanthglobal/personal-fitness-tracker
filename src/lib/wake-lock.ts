/*
 * Keep the screen awake while a timer runs (Screen Wake Lock API).
 * Reference-counted so the rest timer and a warm-up session can overlap safely.
 * The browser drops the lock whenever the page is hidden, so it is re-requested on return.
 * Unsupported browsers simply do nothing (the UI says so).
 */

type Sentinel = { release: () => Promise<void>; addEventListener: (t: "release", fn: () => void) => void };
type WakeLockApi = { request: (type: "screen") => Promise<Sentinel> };

const api = (): WakeLockApi | undefined => (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;

export const wakeLockSupported = () => !!api();

let holders = 0;
let blocked = false;
/** True when the browser refused the last request (battery saver, embedded browser, policy). */
export const wakeLockBlocked = () => blocked;
let sentinel: Sentinel | null = null;
const listeners = new Set<(on: boolean) => void>();

const notify = () => listeners.forEach((fn) => fn(!!sentinel));
export const onWakeLockChange = (fn: (on: boolean) => void) => { listeners.add(fn); return () => listeners.delete(fn); };
export const isScreenKeptOn = () => !!sentinel;

async function request() {
  const wl = api();
  if (!wl || sentinel || holders === 0 || document.visibilityState !== "visible") return;
  try {
    const s = await wl.request("screen");
    if (holders === 0) { await s.release(); return; } // released while we were waiting
    sentinel = s;
    blocked = false;
    s.addEventListener("release", () => { sentinel = null; notify(); });
    notify();
  } catch {
    // e.g. battery saver or permissions policy — the timer still works, screen may dim.
    blocked = true;
    notify();
  }
}

/** Ask to keep the screen on. Returns a function that gives the hold back. */
export function holdScreenOn(): () => void {
  holders++;
  void request();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0 && sentinel) {
      const s = sentinel;
      sentinel = null;
      void s.release().catch(() => {});
      notify();
    }
  };
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void request();
});
