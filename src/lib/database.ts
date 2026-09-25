/*
 * Supabase data access. Maps between the app's AppState and the Postgres tables.
 * RLS enforces ownership server-side; user_id is sent only because the policies CHECK it.
 */
import { allExerciseCodes, getSchedule, TOTAL_DAYS } from "../data/workout-data";
import type { BodyWeightRow, ExerciseNoteRow, ExerciseSetRow, ProgrammeDayRow, ProgrammeRow } from "../types/database";
import { requireClient } from "./supabase";
import { defaultState, lbToKg, type AppState, type BodyWeightEntry, type WeightUnit } from "./state";
import { addDays } from "./utils";

export interface RemoteMeta {
  programmeId: string;
  dayIds: Record<number, string>;
  sessionIds: Record<number, string>;
}

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
const VALID_CODES = new Set(allExerciseCodes());
const kg3 = (n: number) => Math.round(n * 1000) / 1000;

/* ---------------------------------------------------------------------------
 * Load
 * ------------------------------------------------------------------------- */

export interface RemoteSnapshot {
  state: AppState;
  meta: RemoteMeta | null; // null = no active programme (show onboarding)
}

export async function fetchSnapshot(userId: string): Promise<RemoteSnapshot> {
  const [profile, programme, weights] = await Promise.all([
    db().from("profiles").select("weight_unit").eq("id", userId).maybeSingle(),
    db().from("programmes").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db().from("body_weight_entries").select("recorded_at, weight, unit, notes").order("recorded_at"),
  ]);

  const state = defaultState();
  const p = check(profile) as { weight_unit: WeightUnit } | null;
  if (p) state.settings.weightUnit = p.weight_unit === "lb" ? "lb" : "kg";
  state.bodyWeight = (check(weights) as Pick<BodyWeightRow, "recorded_at" | "weight" | "unit" | "notes">[]).map((r) => ({
    date: r.recorded_at,
    weight: r.unit === "lb" ? lbToKg(Number(r.weight)) : Number(r.weight),
    notes: r.notes ?? "",
  }));

  const prog = check(programme) as ProgrammeRow | null;
  if (!prog) return { state, meta: null };

  state.onboarded = true;
  state.settings.startDate = prog.start_date;
  const meta: RemoteMeta = { programmeId: prog.id, dayIds: {}, sessionIds: {} };

  const days = check(await db().from("programme_days").select("id, day_number, completed, completed_at").eq("programme_id", prog.id)) as Pick<
    ProgrammeDayRow, "id" | "day_number" | "completed" | "completed_at"
  >[];
  const dayById: Record<string, number> = {};
  for (const d of days) {
    meta.dayIds[d.day_number] = d.id;
    dayById[d.id] = d.day_number;
    if (d.completed) state.days[d.day_number] = { completed: true, completedAt: d.completed_at };
  }
  if (!days.length) return { state, meta };

  const sessions = check(await db().from("workout_sessions").select("id, programme_day_id").in("programme_day_id", days.map((d) => d.id))) as {
    id: string; programme_day_id: string;
  }[];
  const dayBySession: Record<string, number> = {};
  for (const s of sessions) {
    const n = dayById[s.programme_day_id];
    if (n == null) continue;
    meta.sessionIds[n] = s.id;
    dayBySession[s.id] = n;
  }
  if (!sessions.length) return { state, meta };

  const ids = sessions.map((s) => s.id);
  const [sets, notes] = await Promise.all([
    db().from("exercise_sets").select("workout_session_id, exercise_code, set_number, weight_kg, reps, completed").in("workout_session_id", ids),
    db().from("exercise_notes").select("workout_session_id, exercise_code, notes").in("workout_session_id", ids),
  ]);

  const logFor = (sessionId: string, code: string) => {
    const day = dayBySession[sessionId]!;
    const w = (state.workouts[day] ??= {});
    return (w[code] ??= { sets: [], notes: "" });
  };
  for (const r of check(sets) as ExerciseSetRow[]) {
    const log = logFor(r.workout_session_id, r.exercise_code);
    while (log.sets.length < r.set_number) log.sets.push({ weight: null, reps: null, done: false });
    log.sets[r.set_number - 1] = { weight: r.weight_kg == null ? null : Number(r.weight_kg), reps: r.reps, done: r.completed };
  }
  for (const r of check(notes) as ExerciseNoteRow[]) logFor(r.workout_session_id, r.exercise_code).notes = r.notes;

  return { state, meta };
}

/* ---------------------------------------------------------------------------
 * Programmes
 * ------------------------------------------------------------------------- */

function dayRows(programmeId: string, userId: string, startDate: string, ids?: Record<number, string>) {
  const rows = [];
  for (let n = 1; n <= TOTAL_DAYS; n++) {
    const s = getSchedule(n)!;
    rows.push({
      ...(ids?.[n] ? { id: ids[n] } : {}),
      programme_id: programmeId,
      user_id: userId,
      day_number: n,
      cycle_number: s.cycle,
      workout_code: s.type === "workout" ? s.workout : null,
      workout_type: s.type === "workout" ? s.intensity : null,
      is_rest_day: s.type === "rest",
      scheduled_date: addDays(startDate, n - 1),
    });
  }
  return rows;
}

/** Create a programme and its 60 generated days. Any existing active programme must be ended first. */
export async function createProgramme(userId: string, startDate: string): Promise<RemoteMeta> {
  const prog = check(
    await db().from("programmes").insert({ user_id: userId, start_date: startDate, status: "active" }).select("id").single(),
  ) as { id: string };
  try {
    const days = check(await db().from("programme_days").insert(dayRows(prog.id, userId, startDate)).select("id, day_number")) as {
      id: string; day_number: number;
    }[];
    const meta: RemoteMeta = { programmeId: prog.id, dayIds: {}, sessionIds: {} };
    for (const d of days) meta.dayIds[d.day_number] = d.id;
    return meta;
  } catch (err) {
    await db().from("programmes").delete().eq("id", prog.id); // don't leave a half-created programme
    throw err;
  }
}

export async function endProgramme(programmeId: string, status: "completed" | "cancelled") {
  check(await db().from("programmes").update({ status }).eq("id", programmeId));
}

/** Change start date; re-dates the 60 generated days (completion + logs stay on their day number). */
export async function updateStartDate(meta: RemoteMeta, userId: string, startDate: string) {
  check(await db().from("programmes").update({ start_date: startDate }).eq("id", meta.programmeId));
  check(await db().from("programme_days").upsert(dayRows(meta.programmeId, userId, startDate, meta.dayIds), { onConflict: "id" }));
}

export async function pushProfile(userId: string, weightUnit: WeightUnit) {
  check(await db().from("profiles").update({ weight_unit: weightUnit }).eq("id", userId));
}

/* ---------------------------------------------------------------------------
 * Day / workout log
 * ------------------------------------------------------------------------- */

export async function pushDay(meta: RemoteMeta, userId: string, day: number, state: AppState) {
  const dayId = meta.dayIds[day];
  if (!dayId) throw new DbError("missing_day", `No programme day row for day ${day}`);
  const d = state.days[day];
  const completed = !!d?.completed;
  const completedAt = completed ? d?.completedAt ?? new Date().toISOString() : null;

  check(await db().from("programme_days").update({ completed, completed_at: completedAt }).eq("id", dayId));

  const logs = Object.entries(state.workouts[day] ?? {}).filter(([code]) => VALID_CODES.has(code));
  const hasLogs = logs.some(([, l]) => l.notes || l.sets.some((s) => s.done || s.weight != null || s.reps != null));
  let sessionId = meta.sessionIds[day];
  if (!sessionId && !hasLogs) return;

  if (!sessionId) {
    const row = check(
      await db()
        .from("workout_sessions")
        .upsert({ user_id: userId, programme_day_id: dayId, started_at: new Date().toISOString(), completed_at: completedAt }, { onConflict: "programme_day_id" })
        .select("id")
        .single(),
    ) as { id: string };
    sessionId = meta.sessionIds[day] = row.id;
  } else {
    check(await db().from("workout_sessions").update({ completed_at: completedAt }).eq("id", sessionId));
  }

  const setRows: ExerciseSetRow[] = [];
  const noteRows: ExerciseNoteRow[] = [];
  const emptyNoteCodes: string[] = [];
  for (const [code, log] of logs) {
    log.sets.slice(0, 5).forEach((s, i) =>
      setRows.push({
        user_id: userId,
        workout_session_id: sessionId!,
        exercise_code: code,
        set_number: i + 1,
        weight_kg: s.weight == null ? null : kg3(s.weight),
        reps: s.reps,
        completed: s.done,
      }),
    );
    if (log.notes.trim()) noteRows.push({ user_id: userId, workout_session_id: sessionId, exercise_code: code, notes: log.notes.slice(0, 2000) });
    else emptyNoteCodes.push(code);
  }
  if (setRows.length) check(await db().from("exercise_sets").upsert(setRows, { onConflict: "workout_session_id,exercise_code,set_number" }));
  if (noteRows.length) check(await db().from("exercise_notes").upsert(noteRows, { onConflict: "workout_session_id,exercise_code" }));
  if (emptyNoteCodes.length) {
    check(await db().from("exercise_notes").delete().eq("workout_session_id", sessionId).in("exercise_code", emptyNoteCodes));
  }
}

/* ---------------------------------------------------------------------------
 * Body weight
 * ------------------------------------------------------------------------- */

/** Upsert the entry for a date, or delete it when `entry` is null. Stored in kg. */
export async function pushBodyWeight(userId: string, date: string, entry: BodyWeightEntry | null) {
  if (entry) {
    check(
      await db()
        .from("body_weight_entries")
        .upsert({ user_id: userId, recorded_at: date, weight: kg3(entry.weight), unit: "kg", notes: entry.notes || null }, { onConflict: "user_id,recorded_at" }),
    );
  } else {
    check(await db().from("body_weight_entries").delete().eq("recorded_at", date));
  }
}

/** Delete all of the signed-in user's programmes (cascades to days/sessions/sets) and body weight. */
export async function deleteAllUserData() {
  check(await db().from("programmes").delete().not("id", "is", null));
  check(await db().from("body_weight_entries").delete().not("id", "is", null));
}
