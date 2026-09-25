/*
 * App state: the in-memory model the UI renders from.
 * Persisted to a local cache (storage.ts) and, when Supabase is configured, synced (sync.ts).
 */
import { TOTAL_DAYS, CYCLE_LENGTH, getSchedule } from "../data/workout-data";
import type { Intensity, WorkoutSchedule } from "../types/workout";
import { addDays, getTodayProgramDay, isObj, parseISO, round2, todayISO } from "./utils";

export const STATE_VERSION = 2;
const KG_PER_LB = 0.45359237;

export type WeightUnit = "kg" | "lb";
export type Theme = "system" | "light" | "dark";

export interface SetLog { weight: number | null /* kg */; reps: number | null; done: boolean }
export interface ExerciseLog { sets: SetLog[]; notes: string }
export interface DayState { completed: boolean; completedAt: string | null }
export interface BodyWeightEntry { date: string; weight: number /* kg */; notes: string }

export interface AppState {
  version: number;
  onboarded: boolean;
  settings: { startDate: string; weightUnit: WeightUnit; theme: Theme };
  days: Record<number, DayState>;
  /** day -> exercise code -> log */
  workouts: Record<number, Record<string, ExerciseLog>>;
  bodyWeight: BodyWeightEntry[];
  /** Local-only checklist (not synced). */
  shopping: Record<string, true>;
}

export function defaultState(): AppState {
  return {
    version: STATE_VERSION,
    onboarded: false,
    settings: { startDate: todayISO(), weightUnit: "kg", theme: "system" },
    days: {},
    workouts: {},
    bodyWeight: [],
    shopping: {},
  };
}

const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Validate + normalise raw state (from cache or an imported backup). Throws if unusable. */
export function normalizeState(raw: unknown): AppState {
  if (!isObj(raw)) throw new Error("Not an object");
  if (typeof raw.version !== "number") throw new Error("Missing version");
  if (raw.version > STATE_VERSION) throw new Error("Backup is from a newer version");
  const settings = raw.settings;
  if (!isObj(settings) || !parseISO(settings.startDate)) throw new Error("Missing start date");
  if (!isObj(raw.days) || !isObj(raw.workouts)) throw new Error("Missing programme data");

  const s = defaultState();
  s.onboarded = raw.onboarded !== false;
  s.settings.startDate = settings.startDate as string;
  s.settings.weightUnit = settings.weightUnit === "lb" ? "lb" : "kg";
  s.settings.theme = settings.theme === "light" || settings.theme === "dark" ? settings.theme : "system";

  for (const [k, v] of Object.entries(raw.days)) {
    const n = Number(k);
    if (Number.isInteger(n) && n >= 1 && n <= TOTAL_DAYS && isObj(v)) {
      s.days[n] = { completed: !!v.completed, completedAt: typeof v.completedAt === "string" ? v.completedAt : null };
    }
  }

  for (const [k, exs] of Object.entries(raw.workouts)) {
    const n = Number(k);
    if (!Number.isInteger(n) || n < 1 || n > TOTAL_DAYS || !isObj(exs)) continue;
    const out: Record<string, ExerciseLog> = {};
    for (const [code, log] of Object.entries(exs)) {
      if (!isObj(log)) continue;
      out[code] = {
        sets: Array.isArray(log.sets)
          ? log.sets.slice(0, 5).map((st: unknown) => ({
              weight: isObj(st) ? numOrNull(st.weight) : null,
              reps: isObj(st) && Number.isInteger(st.reps) && (st.reps as number) >= 0 ? (st.reps as number) : null,
              done: isObj(st) && !!st.done,
            }))
          : [],
        notes: typeof log.notes === "string" ? log.notes.slice(0, 2000) : "",
      };
    }
    s.workouts[n] = out;
  }

  if (Array.isArray(raw.bodyWeight)) {
    s.bodyWeight = raw.bodyWeight
      .filter((e): e is Record<string, unknown> => isObj(e) && !!parseISO(e.date) && (numOrNull(e.weight) ?? 0) > 0)
      .map((e) => ({ date: e.date as string, weight: e.weight as number, notes: typeof e.notes === "string" ? e.notes.slice(0, 500) : "" }));
  }

  if (isObj(raw.shopping)) for (const [k, v] of Object.entries(raw.shopping)) if (v === true) s.shopping[k] = true;
  return s;
}

/* ---------------------------------------------------------------------------
 * Store + change notification
 * ------------------------------------------------------------------------- */

export type ChangeKey = "settings" | "profile" | "local" | `day:${number}` | `bw:${string}`;
type Listener = (key: ChangeKey) => void;

export const store: { state: AppState } = { state: defaultState() };
const listeners: Listener[] = [];

export const onChange = (fn: Listener) => { listeners.push(fn); };
/** Call after mutating store.state. Persists locally and (if enabled) queues a cloud sync. */
export const changed = (key: ChangeKey) => listeners.forEach((fn) => fn(key));

const st = () => store.state;

/* ---------------------------------------------------------------------------
 * Programme queries
 * ------------------------------------------------------------------------- */

export const currentDay = () => getTodayProgramDay(st().settings.startDate, todayISO());
export const dateForDay = (day: number) => addDays(st().settings.startDate, day - 1);
export const isDayComplete = (day: number) => !!st().days[day]?.completed;
export const completedCount = () => Object.values(st().days).filter((d) => d.completed).length;

/** "missed" is only used for workouts; a past, unticked rest day is simply "past" (no pressure). */
export type DayStatus = "completed" | "current" | "missed" | "past" | "upcoming";
export function dayStatus(day: number): DayStatus {
  if (isDayComplete(day)) return "completed";
  const today = currentDay();
  if (day === today) return "current";
  if (day > today) return "upcoming";
  return getSchedule(day)?.type === "rest" ? "past" : "missed";
}

export function setDayComplete(day: number, completed: boolean) {
  st().days[day] = { completed, completedAt: completed ? new Date().toISOString() : null };
  changed(`day:${day}`);
}

export function getLog(day: number, code: string): ExerciseLog | null {
  return st().workouts[day]?.[code] ?? null;
}
export function getOrCreateLog(day: number, code: string, sets: number): ExerciseLog {
  const w = (st().workouts[day] ??= {});
  const log = (w[code] ??= { sets: [], notes: "" });
  while (log.sets.length < sets) log.sets.push({ weight: null, reps: null, done: false });
  return log;
}

export const loggedSets = (log: ExerciseLog | null) => (log ? log.sets.filter((s) => s.done && (s.reps != null || s.weight != null)) : []);

export interface PreviousPerformance { day: number; sets: SetLog[]; intensity: Intensity }

/** Most recent earlier performance of an exercise; prefers the same intensity (rep ranges differ). */
export function findPrevious(day: number, code: string, intensity: Intensity): PreviousPerformance | null {
  let fallback: PreviousPerformance | null = null;
  for (let d = day - 1; d >= 1; d--) {
    const sets = loggedSets(getLog(d, code));
    if (!sets.length) continue;
    const sched = getSchedule(d);
    if (!sched || sched.type !== "workout") continue;
    const hit = { day: d, sets, intensity: sched.intensity };
    if (sched.intensity === intensity) return hit;
    fallback ??= hit;
  }
  return fallback;
}

export function workoutProgress(sched: WorkoutSchedule) {
  let setsDone = 0, setsTotal = 0, exDone = 0;
  for (const ex of sched.exercises) {
    const log = getLog(sched.day, ex.code);
    const n = log ? log.sets.slice(0, ex.sets).filter((s) => s.done).length : 0;
    setsDone += n;
    setsTotal += ex.sets;
    if (n >= ex.sets) exDone++;
  }
  return { setsDone, setsTotal, exDone, exTotal: sched.exercises.length };
}

export function programmeTotals() {
  let workouts = 0, rest = 0;
  for (let d = 1; d <= TOTAL_DAYS; d++) getSchedule(d)?.type === "rest" ? rest++ : workouts++;
  return { workouts, rest };
}

export const cycleOf = (day: number) => Math.min(Math.max(Math.ceil(day / CYCLE_LENGTH), 1), TOTAL_DAYS / CYCLE_LENGTH);

export interface PersonalBest { code: string; weight: number; reps: number | null; day: number }
export function personalBests(): PersonalBest[] {
  const best: Record<string, PersonalBest> = {};
  for (const [dayKey, exs] of Object.entries(st().workouts)) {
    for (const [code, log] of Object.entries(exs)) {
      for (const s of loggedSets(log)) {
        if (s.weight == null || s.weight <= 0) continue;
        const b = best[code];
        if (!b || s.weight > b.weight || (s.weight === b.weight && (s.reps ?? 0) > (b.reps ?? 0))) {
          best[code] = { code, weight: s.weight, reps: s.reps, day: Number(dayKey) };
        }
      }
    }
  }
  return Object.values(best).sort((a, b) => b.day - a.day);
}

export const sortedWeights = () => st().bodyWeight.slice().sort((a, b) => a.date.localeCompare(b.date));

/* ---------------------------------------------------------------------------
 * Units (weights are stored in kg; unit is a display preference)
 * ------------------------------------------------------------------------- */

export const unit = (): WeightUnit => st().settings.weightUnit;
export const kgToDisplay = (kg: number) => round2(unit() === "kg" ? kg : kg / KG_PER_LB);
export const displayToKg = (v: number) => (unit() === "kg" ? v : v * KG_PER_LB);
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const fmtW = (kg: number | null) => (kg == null ? "" : String(kgToDisplay(kg)));
export const weightStep = () => (unit() === "kg" ? 2.5 : 5);
export const maxWeight = () => (unit() === "kg" ? 1000 : 2200);

export function fmtSet(s: { weight: number | null; reps: number | null }): string {
  if (s.weight == null) return s.reps != null ? `${s.reps} reps` : "—";
  return `${fmtW(s.weight)} ${unit()} × ${s.reps ?? "—"}`;
}
