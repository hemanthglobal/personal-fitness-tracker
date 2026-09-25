import { $, $$ } from "../lib/utils";
import { session, type SyncStatus } from "../lib/sync";
import { ICON } from "./icons";

export type NavKey = "today" | "calendar" | "progress" | "more";

export function setActiveNav(active: NavKey | null) {
  $$<HTMLAnchorElement>(".nav__item").forEach((a) => {
    const on = a.dataset.nav === active;
    a.classList.toggle("is-active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

const LABEL: Record<SyncStatus, string> = {
  local: "On this device",
  synced: "Synced",
  saving: "Saving…",
  offline: "Offline",
  error: "Couldn't sync · Retry",
};

/** Subtle sync indicator. Only the error state is interactive (retry). */
export function renderSyncStatus(status: SyncStatus) {
  const el = $<HTMLButtonElement>("#sync-status");
  if (!el) return;
  el.hidden = status === "local";
  document.body.classList.toggle("has-sync", status !== "local");
  el.dataset.state = status;
  el.disabled = status !== "error";
  const pending = session.pending;
  const detail = status === "offline" && pending ? ` · ${pending} to sync` : "";
  el.innerHTML = `${status === "offline" ? ICON.cloudOff : status === "error" ? ICON.refresh : ICON.cloud}<span>${LABEL[status]}${detail}</span>`;
  el.setAttribute("aria-label", status === "error" ? "Couldn't sync. Your changes are saved on this device. Tap to retry." : `Sync status: ${LABEL[status]}${detail}`);
}
