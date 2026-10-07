/*
 * Supabase data access. Maps between AppState (v3) and the Postgres tables (migration 0004).
 * RLS enforces ownership server-side; user_id is sent only because the policies CHECK it.
 */
import { BUILTIN_60, type CustomProgram } from "../data/programs";
import { requireClient } from "./supabase";
import {
  defaultState, lbToKg, normProgram, type AppState, type BodyWeightEntry, type ExerciseLog, type Run, type Session, type WeightUnit,
} from "./state";

/** Error carrying a Postgres/PostgREST code so the sync layer can tell transient from permanent failures. */
export class DbError extends Error {
  constructor(public code: string | undefined, message: string) {
    super(message);
  }
}

function check<T>(res: { data: T; error: { code?: string; message: string } | null }): T {
  if (res.error) throw new DbError(res.error.code, res.error.message);
  return res.data;
}

const db = () => requireClient();
const kg3 = (n: number) => Math.round(n * 1000) / 1000;

const toDbStatus = { active: "active", finished: "completed", ended: "cancelled" } as const;
const fromDbStatus = (s: string): Run["status"] => (s === "completed" ? "finished" : s === "cancelled" ? "ended" : "active");

/* ---------------------------------------------------------------------------
 * Load everything for the signed-in user
 * ------------------------------------------------------------------------- */

interface SessionRow {
  id: string; programme_id: string | null; day_number: number | null; workout_key: string | null; title: string;
  session_date: string; status: string; completed_at: string | null; plan: unknown; created_at: string; updated_at: string;
}

export async function fetchSnapshot(userId: string): Promise<AppState> {
  const [profile, programs, runs, runDays, sessions, sets, notes, weights] = await Promise.all([
    db().from("profiles").select("weight_unit").eq("id", userId).maybeSingle(),
    db().from("custom_programs").select("id, name, definition, created_at, updated_at"),
    db().from("programmes").select("id, name, program_ref, start_date, status, ended_at, created_at").order("created_at"),
    db().from("run_days").select("programme_id, day_number, status, occurred_on, session_id"),
    db().from("training_sessions").select("id, programme_id, day_number, workout_key, title, session_date, status, completed_at, plan, created_at, updated_at"),
    db().from("session_sets").select("session_id, exercise_code, set_number, weight_kg, reps, completed"),
    db().from("session_notes").select("session_id, exercise_code, notes"),
    db().from("body_weight_entries").select("recorded_at, weight, unit, notes").order("recorded_at"),
  ]);

  const state = defaultState();
  const p = check(profile) as { weight_unit: WeightUnit } | null;
  if (p) state.settings.weightUnit = p.weight_unit === "lb" ? "lb" : "kg";

  for (const r of check(programs) as { id: string; name: string; definition: Record<string, unknown>; created_at: string; updated_at: string }[]) {
    const prog = normProgram({ ...r.definition, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at }, r.id);
    if (prog) state.programs[r.id] = prog;
  }

  for (const r of check(runs) as { id: string; name: string; program_ref: string; start_date: string; status: string; ended_at: string | null; created_at: string }[]) {
    state.runs[r.id] = {
      id: r.id, programRef: r.program_ref || BUILTIN_60, name: r.name, startDate: r.start_date,
      status: fromDbStatus(r.status), endedAt: r.ended_at, days: {}, createdAt: r.created_at,
    };
    if (r.status === "active") state.activeRunId = r.id;
  }
  for (const d of check(runDays) as { programme_id: string; day_number: number; status: string; occurred_on: string; session_id: string | null }[]) {
    const run = state.runs[d.programme_id];
    if (run) run.days[d.day_number] = { status: d.status === "skipped" ? "skipped" : "done", date: d.occurred_on, sessionId: d.session_id };
  }

  for (const r of check(sessions) as SessionRow[]) {
    state.sessions[r.id] = {
      id: r.id, date: r.session_date, runId: r.programme_id, day: r.day_number, workoutKey: r.workout_key, title: r.title,
      plan: Array.isArray(r.plan) ? (r.plan as Session["plan"]) : [], logs: {},
      status: r.status === "done" ? "done" : "in_progress", completedAt: r.completed_at, createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
  const logOf = (sid: string, code: string): ExerciseLog | null => {
    const s = state.sessions[sid];
    return s ? (s.logs[code] ??= { sets: [], notes: "" }) : null;
  };
  for (const r of check(sets) as { session_id: string; exercise_code: string; set_number: number; weight_kg: number | string | null; reps: number | null; completed: boolean }[]) {
    const log = logOf(r.session_id, r.exercise_code);
    if (!log) continue;
    while (log.sets.length < r.set_number) log.sets.push({ weight: null, reps: null, done: false });
    log.sets[r.set_number - 1] = { weight: r.weight_kg == null ? null : Number(r.weight_kg), reps: r.reps, done: r.completed };
  }
  for (const r of check(notes) as { session_id: string; exercise_code: string; notes: string }[]) {
    const log = logOf(r.session_id, r.exercise_code);
    if (log) log.notes = r.notes;
  }

  state.bodyWeight = (check(weights) as { recorded_at: string; weight: number | string; unit: string; notes: string | null }[]).map((r) => ({
    date: r.recorded_at,
    weight: r.unit === "lb" ? lbToKg(Number(r.weight)) : Number(r.weight),
    notes: r.notes ?? "",
  }));

  state.onboarded = Object.keys(state.runs).length > 0 || Object.keys(state.sessions).length > 0;
  return state;
}

/* ---------------------------------------------------------------------------
 * Push one changed object (upsert, or delete when it no longer exists locally)
 * ------------------------------------------------------------------------- */

export async function pushProfile(userId: string, weightUnit: WeightUnit) {
  check(await db().from("profiles").update({ weight_unit: weightUnit }).eq("id", userId));
}

export async function pushProgram(userId: string, id: string, p: CustomProgram | null) {
  if (!p) { check(await db().from("custom_programs").delete().eq("id", id)); return; }
  const definition = { workouts: p.workouts, pattern: p.pattern, repeats: p.repeats };
  check(await db().from("custom_programs").upsert({ id, user_id: userId, name: p.name, definition }, { onConflict: "id" }));
}

export async function pushRun(userId: string, id: string, run: Run | null) {
  if (!run) { check(await db().from("programmes").delete().eq("id", id)); return; }
  check(await db().from("programmes").upsert({
    id, user_id: userId, name: run.name.slice(0, 120) || "Program", program_ref: run.programRef,
    start_date: run.startDate, status: toDbStatus[run.status], ended_at: run.endedAt,
  }, { onConflict: "id" }));
  const days = Object.entries(run.days).map(([n, d]) => ({
    programme_id: id, user_id: userId, day_number: Number(n), status: d.status, occurred_on: d.date, session_id: d.sessionId,
  }));
  if (days.length) check(await db().from("run_days").upsert(days, { onConflict: "programme_id,day_number" }));
  // Remove days that were un-ticked locally.
  const keep = days.map((d) => d.day_number);
  let del = db().from("run_days").delete().eq("programme_id", id);
  if (keep.length) del = del.not("day_number", "in", `(${keep.join(",")})`);
  check(await del);
}

export async function pushSession(userId: string, id: string, s: Session | null) {
  if (!s) { check(await db().from("training_sessions").delete().eq("id", id)); return; }
  check(await db().from("training_sessions").upsert({
    id, user_id: userId, programme_id: s.runId, day_number: s.runId ? s.day : null, workout_key: s.workoutKey,
    title: s.title.slice(0, 80) || "Workout", session_date: s.date, status: s.status, completed_at: s.completedAt, plan: s.plan,
  }, { onConflict: "id" }));

  const sets: Record<string, unknown>[] = [];
  const notes: Record<string, unknown>[] = [];
  const emptyNotes: string[] = [];
  for (const [code, log] of Object.entries(s.logs)) {
    log.sets.slice(0, 10).forEach((x, i) => sets.push({
      user_id: userId, session_id: id, exercise_code: code, set_number: i + 1,
      weight_kg: x.weight == null ? null : kg3(x.weight), reps: x.reps, completed: x.done,
    }));
    if (log.notes.trim()) notes.push({ user_id: userId, session_id: id, exercise_code: code, notes: log.notes.slice(0, 2000) });
    else emptyNotes.push(code);
  }
  if (sets.length) check(await db().from("session_sets").upsert(sets, { onConflict: "session_id,exercise_code,set_number" }));
  if (notes.length) check(await db().from("session_notes").upsert(notes, { onConflict: "session_id,exercise_code" }));
  if (emptyNotes.length) check(await db().from("session_notes").delete().eq("session_id", id).in("exercise_code", emptyNotes));
  // Exercises removed from a free workout.
  const codes = Object.keys(s.logs);
  let del = db().from("session_sets").delete().eq("session_id", id);
  if (codes.length) del = del.not("exercise_code", "in", `(${codes.join(",")})`);
  check(await del);
}

/** Upsert the entry for a date, or delete it when `entry` is null. Stored in kg. */
export async function pushBodyWeight(userId: string, date: string, entry: BodyWeightEntry | null) {
  if (entry) {
    check(await db().from("body_weight_entries").upsert(
      { user_id: userId, recorded_at: date, weight: kg3(entry.weight), unit: "kg", notes: entry.notes || null },
      { onConflict: "user_id,recorded_at" },
    ));
  } else {
    check(await db().from("body_weight_entries").delete().eq("recorded_at", date));
  }
}

/** Delete all of the signed-in user's training data (RLS limits this to their own rows). */
export async function deleteAllUserData() {
  check(await db().from("training_sessions").delete().not("id", "is", null));
  check(await db().from("programmes").delete().not("id", "is", null));
  check(await db().from("custom_programs").delete().not("id", "is", null));
  check(await db().from("body_weight_entries").delete().not("id", "is", null));
}
