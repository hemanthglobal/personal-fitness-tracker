// Supabase Edge Function: send-reminders
//
// Called every 5 minutes by pg_cron (see supabase/cron_setup.sql.example). For every user with
// notifications enabled it works out their LOCAL time and sends, at most once per day each:
//   quote      — motivation line at quote_time (default 18:00)
//   gym        — "gym in N minutes" at gym_time - remind_before_min (default 19:30); not on rest days
//                or if a workout is already logged today
//   skip_check — at skip_check_time (default 22:00) if nothing is logged today
//   weekly     — Sunday 21:00 summary of the last 7 days
// Duplicates are prevented by inserting into notification_log (unique per user/kind/day) BEFORE sending.
//
// Auth: the cron job sends header x-cron-secret = CRON_SECRET. A signed-in user can POST {"test": true}
// with their own access token to receive a test notification on their devices.
// Deploy with JWT verification OFF (this function checks auth itself).
//
// Secrets (Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically and never leave the server.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Keep identical to src/data/quotes.ts (a test checks this).
const QUOTES: string[] = [
  "Show up today. Your future self is counting the reps.",
  "You don't need motivation. You need to start the first set.",
  "Strong is built one ordinary day at a time.",
  "The hardest part is walking in. You've done harder things.",
  "Small weights, done consistently, beat big plans done never.",
  "Today's workout is a vote for the person you're becoming.",
  "Discipline is remembering what you want most.",
  "Tired is temporary. Skipping lasts longer.",
  "One good session can turn the whole day around.",
  "You won't always feel like it. Go anyway.",
  "Progress hides in the sessions you almost skipped.",
  "Lift the weight, not the excuses.",
  "Every rep is a deposit. Keep investing.",
  "Your body keeps score of the days you show up.",
  "Do it for the version of you that finishes the program.",
  "Consistency beats intensity, and you can have both.",
  "Make today's set better than yesterday's, even by one rep.",
  "Start where you are. Use what you have. Do what you can.",
  "The plan works when you work the plan.",
  "Earn the rest day.",
  "A short workout still counts. Zero doesn't.",
  "Be stubborn about the goal and flexible about the method.",
  "You're one workout away from a better mood.",
  "Breathe, brace, lift. Repeat until strong.",
  "Nobody regrets the workout once it's done.",
  "Build the habit first. The results follow.",
  "Show your excuses the door and your shoes the floor.",
  "Strength is a skill. Practise it today.",
  "Trust the process, and log the process.",
  "Your only competition is last week's you.",
  "Hard days build strong people.",
  "Ten minutes of warm-up beats ten days of injury.",
  "Train like the next rep matters, because it does.",
  "You made a plan for a reason. Honour it today.",
  "Motivation gets you started. Routine keeps you going.",
  "The weights don't care about your mood. Lift anyway.",
  "Keep the promise you made to yourself.",
  "Little by little, then all at once.",
  "Momentum loves a streak. Don't break it.",
  "Finish strong. Then rest like you earned it.",
];

function quoteForDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return QUOTES[((day % QUOTES.length) + QUOTES.length) % QUOTES.length];
}

type Kind = "quote" | "gym" | "skip_check" | "weekly" | "test";
interface Settings {
  user_id: string; timezone: string;
  quote_enabled: boolean; quote_time: string;
  gym_enabled: boolean; gym_time: string; remind_before_min: number;
  skip_check_enabled: boolean; skip_check_time: string;
  weekly_summary_enabled: boolean;
  next_label: string | null; next_is_rest: boolean;
}

const SEND_WINDOW_MIN = 60; // send if the cron runs up to an hour late; the log stops repeats

const env = (k: string) => Deno.env.get(k) ?? "";
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
webpush.setVapidDetails(env("VAPID_SUBJECT") || "mailto:admin@example.com", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));

/** Local date, minutes since midnight and weekday (0 = Sunday) in an IANA timezone. */
function localNow(tz: string) {
  let zone = tz;
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }); } catch { zone = "UTC"; }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
      .formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday };
}

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const inWindow = (now: number, at: number) => now >= at && now < at + SEND_WINDOW_MIN;
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

async function loggedOn(userId: string, date: string) {
  const [s, r, m] = await Promise.all([
    admin.from("training_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("session_date", date).eq("status", "done"),
    admin.from("run_days").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("occurred_on", date),
    admin.from("calendar_marks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("mark_date", date),
  ]);
  return { trained: (s.count ?? 0) > 0, anything: (s.count ?? 0) + (r.count ?? 0) + (m.count ?? 0) > 0 };
}

async function weeklyText(userId: string, today: string) {
  const from = addDays(today, -6);
  const [s, k, p] = await Promise.all([
    admin.from("training_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "done").gte("session_date", from).lte("session_date", today),
    admin.from("calendar_marks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "skipped").gte("mark_date", from).lte("mark_date", today),
    admin.from("profiles").select("weekly_goal").eq("id", userId).maybeSingle(),
  ]);
  const done = s.count ?? 0, skipped = k.count ?? 0, goal = (p.data as { weekly_goal?: number } | null)?.weekly_goal ?? 4;
  const verdict = done >= goal ? "Goal reached. Great week!" : done > 0 ? `${goal - done} short of your goal. Next week's a fresh start.` : "A quiet week. Let's get back to it.";
  return `${done} workout${done === 1 ? "" : "s"} this week (goal ${goal})${skipped ? ` · ${skipped} skipped day${skipped === 1 ? "" : "s"}` : ""}. ${verdict}`;
}

/** Record the send first (unique per day), then push. Returns true if this call sent it. */
async function claim(userId: string, kind: Kind, date: string) {
  if (kind === "test") return true;
  const { data, error } = await admin.from("notification_log")
    .upsert({ user_id: userId, kind, local_date: date }, { onConflict: "user_id,kind,local_date", ignoreDuplicates: true })
    .select("id");
  return !error && (data?.length ?? 0) > 0;
}

async function pushTo(userId: string, payload: { title: string; body: string; url: string; tag: string }) {
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
      await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", s.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id); // device unsubscribed
      else console.error("push failed", status);
    }
  }
  return sent;
}

async function processUser(s: Settings): Promise<string[]> {
  const now = localNow(s.timezone);
  const out: string[] = [];
  const send = async (kind: Kind, title: string, body: string, url = "#/today") => {
    if (await claim(s.user_id, kind, now.date)) { await pushTo(s.user_id, { title, body, url, tag: kind }); out.push(kind); }
  };

  if (s.quote_enabled && inWindow(now.minutes, toMin(s.quote_time))) {
    await send("quote", "Daily motivation", quoteForDate(now.date));
  }
  const gymAt = toMin(s.gym_time) - s.remind_before_min;
  if (s.gym_enabled && !s.next_is_rest && inWindow(now.minutes, gymAt)) {
    const { trained } = await loggedOn(s.user_id, now.date);
    if (!trained) {
      const mins = s.remind_before_min;
      await send("gym", mins ? `Gym in ${mins} minutes. Hit the gym!` : "Time to hit the gym!", s.next_label ? `Today: ${s.next_label}` : "Your next workout is waiting.");
    }
  }
  if (s.skip_check_enabled && inWindow(now.minutes, toMin(s.skip_check_time))) {
    const { anything } = await loggedOn(s.user_id, now.date);
    if (!anything) await send("skip_check", "Nothing logged today", "Did you train? Log it, or mark today as skipped.");
  }
  if (s.weekly_summary_enabled && now.weekday === 0 && inWindow(now.minutes, 21 * 60)) {
    await send("weekly", "Your week", await weeklyText(s.user_id, now.date), "#/progress");
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    // Test mode: a signed-in user asks for a test notification on their own devices.
    const body = await req.json().catch(() => ({}));
    if (body?.test) {
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data } = await admin.auth.getUser(token);
      if (!data.user) return json({ error: "unauthorized" }, 401);
      const sent = await pushTo(data.user.id, { title: "Notifications are on", body: quoteForDate(localNow("UTC").date), url: "#/settings", tag: "test" });
      return json({ sent });
    }

    if (!env("CRON_SECRET") || req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return json({ error: "unauthorized" }, 401);
    const { data: rows, error } = await admin.from("notification_settings").select("*").eq("enabled", true);
    if (error) throw error;
    const results: Record<string, string[]> = {};
    for (const s of (rows ?? []) as Settings[]) {
      try { results[s.user_id.slice(0, 8)] = await processUser(s); } catch (err) { console.error("user failed", err); }
    }
    return json({ ok: true, users: rows?.length ?? 0, results });
  } catch (err) {
    console.error(err);
    return json({ error: "failed" }, 500);
  }
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
