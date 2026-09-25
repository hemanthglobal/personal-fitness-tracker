/* Supabase Auth: email + password. Errors are mapped to friendly text; raw errors never reach the UI. */
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { requireClient } from "./supabase";

/** Where auth emails (confirm / reset) send the user back to: this app's own URL. */
const redirectTo = () => `${location.origin}${location.pathname}`;

export function friendlyAuthError(err: unknown): string {
  const e = err as { message?: string; code?: string; status?: number } | null;
  const code = e?.code ?? "";
  const msg = (e?.message ?? "").toLowerCase();
  if (import.meta.env.DEV) console.warn("[auth]", err);
  if (code === "invalid_credentials" || msg.includes("invalid login")) return "Email or password is incorrect.";
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) return "Confirm your email first. Check your inbox for the link.";
  if (code === "user_already_exists" || msg.includes("already registered")) return "An account with this email already exists. Try logging in.";
  if (code === "weak_password" || msg.includes("password should")) return "Choose a stronger password (at least 8 characters).";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || e?.status === 429) return "Too many attempts. Wait a minute and try again.";
  if (code === "same_password") return "Your new password must be different from the old one.";
  if (msg.includes("fetch") || msg.includes("network") || !navigator.onLine) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

async function run<R extends { data: unknown; error: unknown }>(fn: () => Promise<R>): Promise<R["data"]> {
  let res: R;
  try {
    res = await fn();
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
  if (res.error) throw new Error(friendlyAuthError(res.error));
  return res.data;
}

export const signIn = (email: string, password: string) =>
  run(() => requireClient().auth.signInWithPassword({ email, password }));

/** Returns true when the project requires email confirmation (no session yet). */
export async function signUp(email: string, password: string): Promise<boolean> {
  const data = await run(() => requireClient().auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } }));
  return !data.session;
}

export const sendPasswordReset = (email: string) =>
  run(() => requireClient().auth.resetPasswordForEmail(email, { redirectTo: redirectTo() }));

export const updatePassword = (password: string) => run(() => requireClient().auth.updateUser({ password }));

export async function signOut() {
  try {
    await requireClient().auth.signOut({ scope: "local" });
  } catch {
    /* Local session is cleared regardless. */
  }
}

export async function getSession(): Promise<Session | null> {
  const { data } = await requireClient().auth.getSession();
  return data.session;
}

export function onAuth(fn: (event: AuthChangeEvent, session: Session | null) => void) {
  return requireClient().auth.onAuthStateChange(fn);
}
