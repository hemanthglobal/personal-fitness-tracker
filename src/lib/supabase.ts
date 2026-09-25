import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public values only. The publishable key is designed for browser use; RLS protects the data.
// Never put a secret / service_role key in the frontend.
// Accept a pasted REST endpoint too (…supabase.co/rest/v1/) — the client needs the bare project URL.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Cloud mode is on when both public env vars are set. Otherwise the app runs local-only. */
export const cloudEnabled = !!(url && key && /^https:\/\//.test(url) && !url.includes("your-project"));

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE puts the auth code in ?code=, which doesn't collide with our #/hash routes.
        flowType: "pkce",
      },
    })
  : null;

export function requireClient(): SupabaseClient {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}
