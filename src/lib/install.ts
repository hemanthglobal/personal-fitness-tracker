/*
 * "Install as app": capture the browser's install prompt (Chrome/Edge/Android) or explain the
 * iPhone steps (Safari → Share → Add to Home Screen). Installed apps open full-screen, and on
 * iPhone web push only works for installed apps.
 */
import { isIOS, isStandalone } from "./push";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
export const onInstallChange = (fn: () => void) => { listeners.add(fn); };

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  listeners.forEach((fn) => fn());
});
window.addEventListener("appinstalled", () => {
  deferred = null;
  listeners.forEach((fn) => fn());
});

export type InstallState = "installed" | "prompt" | "ios" | "manual";
export function installState(): InstallState {
  if (isStandalone()) return "installed";
  if (deferred) return "prompt";
  return isIOS() ? "ios" : "manual";
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  listeners.forEach((fn) => fn());
  return outcome === "accepted";
}
