/*
 * Web Push on this device: ask permission, subscribe with the app's public VAPID key, and store
 * the subscription in Supabase (push_subscriptions, RLS: own rows). The send-reminders Edge
 * Function uses it to deliver reminders even when the app is closed.
 */
import { cloudEnabled, requireClient } from "./supabase";

const VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? "";

export const pushConfigured = () => cloudEnabled && VAPID.length > 40;
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const permission = (): NotificationPermission | "unsupported" => ("Notification" in window ? Notification.permission : "unsupported");

function keyBytes(b64url: string): Uint8Array {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  return navigator.serviceWorker.ready;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export type EnableResult = "ok" | "denied" | "unsupported" | "not-configured" | "error";

/** Ask permission (must be called from a tap), subscribe and save. */
export async function enablePushOnThisDevice(): Promise<EnableResult> {
  if (!pushConfigured()) return "not-configured";
  if (!pushSupported()) return "unsupported";
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "denied";
    const reg = await registration();
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) as BufferSource }));
    const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.keys?.p256dh || !json.keys.auth) return "error";
    const { error } = await requireClient().from("push_subscriptions").upsert({
      endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 300),
    }, { onConflict: "endpoint" });
    if (error) { if (import.meta.env.DEV) console.error(error); return "error"; }
    return "ok";
  } catch (err) {
    if (import.meta.env.DEV) console.error(err);
    return "error";
  }
}

/** Stop notifications on this device (e.g. on log out). Never throws. */
export async function disablePushOnThisDevice() {
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    if (cloudEnabled) await requireClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch { /* best effort */ }
}

/** Ask the server to send a test notification to this account's devices. Returns devices reached. */
export async function sendTestNotification(): Promise<number> {
  const client = requireClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Log in first.");
  const url = `${(import.meta.env.VITE_SUPABASE_URL as string).replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "")}/functions/v1/send-reminders`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      body: JSON.stringify({ test: true }),
    });
  } catch {
    throw new Error("Couldn't reach the reminder service. Check your connection.");
  }
  if (res.status === 404) throw new Error("The reminder function isn't deployed yet. See the setup guide.");
  if (!res.ok) throw new Error("The reminder service returned an error. Check its secrets in Supabase.");
  const body = (await res.json()) as { sent?: number };
  return body.sent ?? 0;
}
