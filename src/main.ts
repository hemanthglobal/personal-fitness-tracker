/* Boot: local-only mode, or Supabase Auth -> load user data -> render. */
import "./styles/main.css";
import type { Session } from "@supabase/supabase-js";
import { applyTheme, getPhase, render, setPhase } from "./app";
import { toast } from "./components/toast";
import { onAuth } from "./lib/auth";
import { endSession, initLocal, initUser, onProblem, pull, session } from "./lib/sync";
import { cloudEnabled } from "./lib/supabase";
import { $, todayISO } from "./lib/utils";

onProblem((msg) => toast(msg, "error"));

if (!cloudEnabled) {
  const error = initLocal();
  applyTheme();
  if (!location.hash) history.replaceState(null, "", "#/today");
  render();
  if (error) toast(error, "error");
} else {
  let userId: string | null = null;
  let recovery = false;

  async function startUser(s: Session) {
    userId = s.user.id;
    const hadCache = initUser(s.user.id, s.user.email ?? "");
    applyTheme();
    if (/^#\/(login|signup|forgot)?$/.test(location.hash) || !location.hash) history.replaceState(null, "", "#/today");

    if (hadCache) {
      // Show cached data instantly, refresh from the server in the background.
      setPhase(recovery ? "recovery" : "app");
      try {
        const changed = await pull();
        const editing = document.activeElement?.matches("input, textarea");
        if (changed && getPhase() === "app" && !editing) { applyTheme(); render({ keepScroll: true }); }
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[boot] background refresh failed", err);
      }
      return;
    }
    setPhase("loading");
    try {
      await pull();
      applyTheme();
      setPhase(recovery ? "recovery" : "app");
    } catch (err) {
      if (import.meta.env.DEV) console.error("[boot] initial load failed", err);
      setPhase("load-failed");
    }
  }

  onAuth((event, s) => {
    // Don't call Supabase inside the callback itself (the client holds a lock); defer.
    setTimeout(() => {
      if (event === "PASSWORD_RECOVERY") {
        recovery = true;
        if (s && s.user.id !== userId) void startUser(s);
        else setPhase("recovery");
        return;
      }
      if (s && s.user.id !== userId) {
        void startUser(s);
        return;
      }
      if (!s) {
        if (userId) {
          // Keep unsynced changes if the session expired; otherwise clear this user's cache.
          endSession({ wipeCache: session.pending === 0 });
          userId = null;
          applyTheme();
          toast("Logged out");
        }
        recovery = false;
        if (!/^#\/(login|signup|forgot)$/.test(location.hash)) history.replaceState(null, "", "#/login");
        setPhase("auth");
      }
    }, 0);
  });
}

// The date rolls over while the app sits open (e.g. overnight on a phone).
let lastSeen = todayISO();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || todayISO() === lastSeen) return;
  lastSeen = todayISO();
  if (getPhase() === "app" && !$(".workout")) render({ keepScroll: true });
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
