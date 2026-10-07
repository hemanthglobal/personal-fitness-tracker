/*
 * App state: the in-memory model the UI renders from.
 * Persisted to a local cache (storage.ts) and, when Supabase is configured, synced (sync.ts).
 *
 * Model (v3):
 *   programs  — user-made programs (the built-in "60 Days to Fit" lives in code)
 *   runs      — a program started on a date; one active at a time; old runs kept as history
 *   sessions  — what was actually trained on a date: a program day, a swapped workout, or a free workout
 */
import {
  BUILTIN_60, programLength, programName, slotFor, type CustomProgram, type ProgramExercise, type Slot,
} from "../data/programs";
import { CYCLE_LENGTH, TOTAL_DAYS } from "../data/workout-data";
import { projectRun, type Projection, type RunDay } from "./schedule";
import { addDays, daysBetween, isObj, parseISO, round2, toISO, todayISO } from "./utils";

export const STATE_VERSION = 3;
const KG_PER_LB = 0.45359237;

export type WeightUnit = "kg" | "lb";
export type Theme = "system" | "light" | "dark";

export interface SetLog { weight: number | null /* kg */; reps: number | null; done: boolean }
export interface ExerciseLog { sets: SetLog[]; notes: string }
export interface BodyWeightEntry { date: string; weight: number /* kg */; notes: string }

export interface Run {
  id: string;
  programRef: string;
  /** Program name when started (kept if the program is later renamed or deleted). */
  name: string;
  startDate: string;
  status: "active" | "finished" | "ended";
  endedAt: string | null;
  days: Record<number, RunDay>;
  createdAt: string;
}

export interface Session {
  id: string;
  /** Calendar date it was trained (YYYY-MM-DD). */
  date: string;
  runId: string | null;
  /** Program day it counts as; null for a free workout. */
  day: number | null;
  workoutKey: string | null;
  title: string;
  /** Exercises + targets at the time (so later program edits don't rewrite history). */
  plan: ProgramExercise[];
  logs: Record<string, ExerciseLog>;
  status: "in_progress" | "done";
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  version: number;
  onboarded: boolean;
  settings: { weightUnit: WeightUnit; theme: Theme; /** Timer beeps (local only). */ sound: boolean };
  programs: Record<string, CustomProgram>;
  runs: Record<string, Run>;
  activeRunId: string | null;
  sessions: Record<string, Session>;
  bodyWeight: BodyWeightEntry[];
  /** Local-only checklist (not synced). */
  shopping: Record<string, true>;
}

export function defaultState(): AppState {
  return {
    version: STATE_VERSION,
    onboarded: false,
    settings: { weightUnit: "kg", theme: "system", sound: true },
    programs: {},
    runs: {},
    activeRunId: null,
    sessions: {},
    bodyWeight: [],
    shopping: {},
  };
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
}

const nowISO = () => new Date().toISOString();

/* ---------------------------------------------------------------------------
 * Validation / migration of stored or imported data
 * ------------------------------------------------------------------------- */

const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const str = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);
const isDate = (v: unknown): v is string => !!parseISO(v);
const CODE_RE = /^[a-z0-9_]{2,64}$/;

function normLog(log: unknown): ExerciseLog | null {
  if (!isObj(log)) return null;
  return {
    sets: Array.isArray(log.sets)
      ? log.sets.slice(0, 10).map((s: unknown) => ({
          weight: isObj(s) ? numOrNull(s.weight) : null,
          reps: isObj(s) && Number.isInteger(s.reps) && (s.reps as number) >= 0 ? (s.reps as number) : null,
          done: isObj(s) && !!s.done,
        }))
      : [],
    notes: str(log.notes, 2000),
  };
}

function normLogs(raw: unknown): Record<string, ExerciseLog> {
  const out: Record<string, ExerciseLog> = {};
  if (isObj(raw)) for (const [code, log] of Object.entries(raw)) { const l = normLog(log); if (l && CODE_RE.test(code)) out[code] = l; }
  return out;
}

function normPlan(raw: unknown): ProgramExercise[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObj).filter((e) => typeof e.code === "string" && CODE_RE.test(e.code)).slice(0, 40).map((e) => ({
    code: e.code as string,
    name: str(e.name, 80, e.code as string),
    sets: Number.isInteger(e.sets) ? Math.min(Math.max(e.sets as number, 1), 10) : 3,
    reps: Number.isInteger(e.reps) ? Math.min(Math.max(e.reps as number, 1), 100) : null,
    ...(typeof e.superset === "string" ? { superset: e.superset.slice(0, 8) } : {}),
  }));
}

export function normProgram(raw: unknown, id: string): CustomProgram | null {
  if (!isObj(raw)) return null;
  const workouts = Array.isArray(raw.workouts)
    ? raw.workouts.filter(isObj).slice(0, 14).map((w, i) => ({
        key: typeof w.key === "string" && /^[a-z0-9_-]{1,24}$/.test(w.key) ? w.key : `w${i + 1}`,
        name: str(w.name, 40, `Workout ${i + 1}`) || `Workout ${i + 1}`,
        short: str(w.short, 4, "W") || "W",
        exercises: normPlan(w.exercises),
      }))
    : [];
  const keys = new Set(workouts.map((w) => w.key));
  const pattern = Array.isArray(raw.pattern)
    ? raw.pattern.slice(0, 28).map((k) => (typeof k === "string" && keys.has(k) ? k : null))
    : [];
  if (!workouts.length || !pattern.length) return null;
  return {
    id,
    name: str(raw.name, 80, "My program") || "My program",
    workouts,
    pattern,
    repeats: Number.isInteger(raw.repeats) && (raw.repeats as number) >= 1 ? Math.min(raw.repeats as number, 52) : null,
    createdAt: str(raw.createdAt, 40, nowISO()),
    updatedAt: str(raw.updatedAt, 40, nowISO()),
  };
}

function normRun(raw: unknown, id: string): Run | null {
  if (!isObj(raw) || typeof raw.programRef !== "string" || !isDate(raw.startDate)) return null;
  const days: Record<number, RunDay> = {};
  if (isObj(raw.days)) {
    for (const [k, v] of Object.entries(raw.days)) {
      const n = Number(k);
      if (!Number.isInteger(n) || n < 1 || n > 1000 || !isObj(v) || !isDate(v.date)) continue;
      days[n] = { status: v.status === "skipped" ? "skipped" : "done", date: v.date, sessionId: typeof v.sessionId === "string" ? v.sessionId : null };
    }
  }
  return {
    id,
    programRef: raw.programRef.slice(0, 64),
    name: str(raw.name, 80, "Program"),
    startDate: raw.startDate,
    status: raw.status === "finished" || raw.status === "ended" ? raw.status : "active",
    endedAt: typeof raw.endedAt === "string" ? raw.endedAt : null,
    days,
    createdAt: str(raw.createdAt, 40, nowISO()),
  };
}

function normSession(raw: unknown, id: string): Session | null {
  if (!isObj(raw) || !isDate(raw.date)) return null;
  return {
    id,
    date: raw.date,
    runId: typeof raw.runId === "string" ? raw.runId : null,
    day: Number.isInteger(raw.day) && (raw.day as number) >= 1 ? (raw.day as number) : null,
    workoutKey: typeof raw.workoutKey === "string" ? raw.workoutKey.slice(0, 40) : null,
    title: str(raw.title, 80, "Workout") || "Workout",
    plan: normPlan(raw.plan),
    logs: normLogs(raw.logs),
    status: raw.status === "done" ? "done" : "in_progress",
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
    createdAt: str(raw.createdAt, 40, nowISO()),
    updatedAt: str(raw.updatedAt, 40, nowISO()),
  };
}

/** v1/v2 (single fixed 60-day programme) → v3 (programs, runs, sessions). */
function migrateV2(raw: Record<string, unknown>, s: AppState) {
  const settings = raw.settings as Record<string, unknown>;
  if (!isDate(settings.startDate)) throw new Error("Missing start date");
  if (!isObj(raw.days) || !isObj(raw.workouts)) throw new Error("Missing programme data");
  const start = settings.startDate;
  const run: Run = { id: uuid(), programRef: BUILTIN_60, name: "60 Days to Fit", startDate: start, status: "active", endedAt: null, days: {}, createdAt: nowISO() };
  const doneOn = (n: number, at: unknown) => {
    const t = typeof at === "string" ? new Date(at) : null;
    return t && !Number.isNaN(t.getTime()) ? toISO(t) : addDays(start, n - 1);
  };
  for (let n = 1; n <= TOTAL_DAYS; n++) {
    const d = (raw.days as Record<string, unknown>)[n];
    const done = isObj(d) && !!d.completed;
    const logs = normLogs((raw.workouts as Record<string, unknown>)[n]);
    const hasLogs = Object.values(logs).some((l) => l.notes || l.sets.some((x) => x.done || x.weight != null || x.reps != null));
    const slot = slotFor(BUILTIN_60, n, {})!;
    const date = done ? doneOn(n, (d as Record<string, unknown>).completedAt) : addDays(start, n - 1);
    let sessionId: string | null = null;
    if (hasLogs && slot.type === "workout") {
      sessionId = uuid();
      s.sessions[sessionId] = {
        id: sessionId, date, runId: run.id, day: n, workoutKey: slot.key, title: slot.name, plan: slot.exercises, logs,
        status: done ? "done" : "in_progress", completedAt: done ? str((d as Record<string, unknown>).completedAt, 40) || null : null,
        createdAt: nowISO(), updatedAt: nowISO(),
      };
    }
    if (done) run.days[n] = { status: "done", date, sessionId };
  }
  s.runs[run.id] = run;
  s.activeRunId = run.id;
}

/** Validate + normalise raw state (from cache or an imported backup). Throws if unusable. */
export function normalizeState(raw: unknown): AppState {
  if (!isObj(raw)) throw new Error("Not an object");
  if (typeof raw.version !== "number") throw new Error("Missing version");
  if (raw.version > STATE_VERSION) throw new Error("Backup is from a newer version");
  if (!isObj(raw.settings)) throw new Error("Missing settings");

  const s = defaultState();
  const settings = raw.settings;
  s.onboarded = raw.onboarded !== false;
  s.settings.weightUnit = settings.weightUnit === "lb" ? "lb" : "kg";
  s.settings.theme = settings.theme === "light" || settings.theme === "dark" ? settings.theme : "system";
  s.settings.sound = settings.sound !== false;

  if (raw.version < 3) {
    // A v2 cache that never finished setup has nothing to migrate (no programme was started).
    if (raw.onboarded !== false) migrateV2(raw, s);
    else if (!isObj(raw.days) || !isObj(raw.workouts)) throw new Error("Missing programme data");
  } else {
    if (!isObj(raw.runs) || !isObj(raw.sessions)) throw new Error("Missing programme data");
    if (isObj(raw.programs)) for (const [id, p] of Object.entries(raw.programs)) { const n = normProgram(p, id); if (n) s.programs[id] = n; }
    for (const [id, r] of Object.entries(raw.runs)) { const n = normRun(r, id); if (n) s.runs[id] = n; }
    for (const [id, x] of Object.entries(raw.sessions)) { const n = normSession(x, id); if (n) s.sessions[id] = n; }
    const active = typeof raw.activeRunId === "string" ? raw.activeRunId : null;
    s.activeRunId = active && s.runs[active]?.status === "active" ? active : null;
  }

  if (Array.isArray(raw.bodyWeight)) {
    s.bodyWeight = raw.bodyWeight
      .filter((e): e is Record<string, unknown> => isObj(e) && isDate(e.date) && (numOrNull(e.weight) ?? 0) > 0)
      .map((e) => ({ date: e.date as string, weight: e.weight as number, notes: str(e.notes, 500) }));
  }
  if (isObj(raw.shopping)) for (const [k, v] of Object.entries(raw.shopping)) if (v === true) s.shopping[k] = true;
  return s;
}

/* ---------------------------------------------------------------------------
 * Store + change notification
 * ------------------------------------------------------------------------- */

export type ChangeKey = "profile" | "local" | `run:${string}` | `session:${string}` | `program:${string}` | `bw:${string}`;
type Listener = (key: ChangeKey) => void;

export const store: { state: AppState } = { state: defaultState() };
const listeners: Listener[] = [];

export const onChange = (fn: Listener) => { listeners.push(fn); };
/** Call after mutating store.state. Persists locally and (if enabled) queues a cloud sync. */
export const changed = (key: ChangeKey) => listeners.forEach((fn) => fn(key));

const st = () => store.state;

/* ---------------------------------------------------------------------------
 * Runs, days and projection
 * ------------------------------------------------------------------------- */

export const activeRun = (): Run | null => (st().activeRunId ? st().runs[st().activeRunId!] ?? null : null);
export const runLength = (run: Run) => programLength(run.programRef, st().programs);
export const runSlot = (run: Run, day: number): Slot | null => slotFor(run.programRef, day, st().programs);
export const runProgramName = (run: Run) => (run.programRef === BUILTIN_60 ? "60 Days to Fit" : st().programs[run.programRef.slice(7)]?.name ?? run.name);
export const isBuiltin = (run: Run | null) => run?.programRef === BUILTIN_60;

const projCache = new Map<string, { key: string; value: Projection }>();
export function projection(run: Run): Projection {
  const len = runLength(run);
  const key = `${run.startDate}|${run.status}|${todayISO()}|${len}|${JSON.stringify(run.days)}`;
  const hit = projCache.get(run.id);
  if (hit?.key === key) return hit.value;
  const value = projectRun(run, len, todayISO());
  projCache.set(run.id, { key, value });
  return value;
}

/** Date a day happened on, or is projected for. */
export const planDate = (run: Run, day: number) => projection(run).dates[day] ?? addDays(run.startDate, day - 1);

/**
 * The day "Today" is about for the active run: below 1 before its start date (days to go),
 * the next undone day once started, or length + 1 when complete. Null without an active run.
 */
export function currentDay(): number | null {
  const run = activeRun();
  if (!run) return null;
  const before = daysBetween(run.startDate, todayISO()) + 1;
  if (before < 1 && !Object.keys(run.days).length) return before;
  return projection(run).next ?? (runLength(run) ?? 0) + 1;
}

export type DayStatus = "done" | "skipped" | "current" | "upcoming";
export function dayStatus(run: Run, day: number): DayStatus {
  const d = run.days[day];
  if (d) return d.status;
  return day === projection(run).next ? "current" : "upcoming";
}

export const resolvedCount = (run: Run, status?: "done" | "skipped") =>
  Object.values(run.days).filter((d) => !status || d.status === status).length;

function maybeFinish(run: Run) {
  const len = runLength(run);
  if (len != null && run.status === "active" && resolvedCount(run) >= len) {
    run.status = "finished";
    run.endedAt = nowISO();
  }
}

/** Rest day: mark done (rested) or skipped (trained instead). Undo with status null. */
export function setRestDay(run: Run, day: number, status: "done" | "skipped" | null) {
  if (status) run.days[day] = { status, date: todayISO(), sessionId: null };
  else delete run.days[day];
  if (!status && run.status === "finished") { run.status = "active"; run.endedAt = null; st().activeRunId ??= run.id; }
  maybeFinish(run);
  changed(`run:${run.id}`);
}

/** Start a program. Ends the current active run (kept in history). */
export function startRun(programRef: string, startDate: string): Run {
  const cur = activeRun();
  if (cur) { cur.status = "ended"; cur.endedAt = nowISO(); changed(`run:${cur.id}`); }
  const run: Run = {
    id: uuid(), programRef, name: programName(programRef, st().programs), startDate,
    status: "active", endedAt: null, days: {}, createdAt: nowISO(),
  };
  st().runs[run.id] = run;
  st().activeRunId = run.id;
  changed(`run:${run.id}`);
  return run;
}

export function endRun(run: Run) {
  run.status = "ended";
  run.endedAt = nowISO();
  if (st().activeRunId === run.id) st().activeRunId = null;
  changed(`run:${run.id}`);
}

/* ---------------------------------------------------------------------------
 * Sessions
 * ------------------------------------------------------------------------- */

export const sessionsSorted = () =>
  Object.values(st().sessions).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

export const sessionsOn = (date: string) => sessionsSorted().filter((s) => s.date === date);

/** The session logged for a run day (done or in progress), if any. */
export function sessionForDay(run: Run, day: number): Session | null {
  const id = run.days[day]?.sessionId;
  if (id && st().sessions[id]) return st().sessions[id]!;
  return Object.values(st().sessions).find((s) => s.runId === run.id && s.day === day) ?? null;
}

/** Exercises for a session: its snapshot, or the program's definition for old/migrated sessions. */
export function sessionPlan(s: Session): ProgramExercise[] {
  if (s.plan.length) return s.plan;
  const run = s.runId ? st().runs[s.runId] : null;
  const slot = run && s.day ? runSlot(run, s.day) : null;
  return slot?.type === "workout" ? slot.exercises : [];
}

export function createSession(init: { runId: string | null; day: number | null; workoutKey: string | null; title: string; plan: ProgramExercise[]; date?: string }): Session {
  const s: Session = {
    id: uuid(), date: init.date ?? todayISO(), runId: init.runId, day: init.day, workoutKey: init.workoutKey,
    title: init.title, plan: init.plan.map((e) => ({ ...e })), logs: {}, status: "in_progress",
    completedAt: null, createdAt: nowISO(), updatedAt: nowISO(),
  };
  st().sessions[s.id] = s;
  changed(`session:${s.id}`);
  return s;
}

export function touch(s: Session) { s.updatedAt = nowISO(); changed(`session:${s.id}`); }

export function getOrCreateLog(s: Session, code: string, sets: number): ExerciseLog {
  const log = (s.logs[code] ??= { sets: [], notes: "" });
  while (log.sets.length < sets) log.sets.push({ weight: null, reps: null, done: false });
  return log;
}

export function completeSession(s: Session, done: boolean, onDate?: string) {
  s.status = done ? "done" : "in_progress";
  s.completedAt = done ? nowISO() : null;
  if (onDate) s.date = onDate;
  touch(s);
  const run = s.runId ? st().runs[s.runId] : null;
  if (run && s.day) {
    if (done) run.days[s.day] = { status: "done", date: s.date, sessionId: s.id };
    else {
      delete run.days[s.day];
      if (run.status === "finished") { run.status = "active"; run.endedAt = null; st().activeRunId ??= run.id; }
    }
    maybeFinish(run);
    changed(`run:${run.id}`);
  }
}

/** Move a session (and its program day) to another date. */
export function setSessionDate(s: Session, date: string) {
  s.date = date;
  touch(s);
  const run = s.runId ? st().runs[s.runId] : null;
  if (run && s.day && run.days[s.day]) { run.days[s.day]!.date = date; changed(`run:${run.id}`); }
}

export function deleteSession(s: Session) {
  const run = s.runId ? st().runs[s.runId] : null;
  if (run && s.day && run.days[s.day]?.sessionId === s.id) { delete run.days[s.day]; changed(`run:${run.id}`); }
  delete st().sessions[s.id];
  changed(`session:${s.id}`);
}

export const loggedSets = (log: ExerciseLog | null | undefined) => (log ? log.sets.filter((x) => x.done && (x.reps != null || x.weight != null)) : []);

export interface PreviousPerformance { session: Session; sets: SetLog[] }

/** Most recent earlier performance of an exercise, preferring the same workout (rep ranges differ). */
export function findPrevious(current: Session | null, code: string, workoutKey: string | null): PreviousPerformance | null {
  const before = sessionsSorted().filter((s) => s.id !== current?.id && (!current || s.date < current.date || (s.date === current.date && s.createdAt < current.createdAt)));
  let fallback: PreviousPerformance | null = null;
  for (let i = before.length - 1; i >= 0; i--) {
    const s = before[i]!;
    const sets = loggedSets(s.logs[code]);
    if (!sets.length) continue;
    if (!workoutKey || s.workoutKey === workoutKey) return { session: s, sets };
    fallback ??= { session: s, sets };
  }
  return fallback;
}

export function sessionProgress(plan: ProgramExercise[], s: Session | null) {
  let setsDone = 0, setsTotal = 0, exDone = 0;
  for (const ex of plan) {
    const log = s?.logs[ex.code];
    const total = Math.max(ex.sets, log?.sets.length ?? 0);
    const n = log ? log.sets.filter((x) => x.done).length : 0;
    setsDone += n;
    setsTotal += total;
    if (n >= total && total > 0) exDone++;
  }
  return { setsDone, setsTotal, exDone, exTotal: plan.length };
}

export const cycleOf = (day: number) => Math.min(Math.max(Math.ceil(day / CYCLE_LENGTH), 1), TOTAL_DAYS / CYCLE_LENGTH);

export interface PersonalBest { code: string; name: string; weight: number; reps: number | null; date: string }
export function personalBests(): PersonalBest[] {
  const best: Record<string, PersonalBest> = {};
  for (const s of sessionsSorted()) {
    const names = Object.fromEntries(sessionPlan(s).map((e) => [e.code, e.name]));
    for (const [code, log] of Object.entries(s.logs)) {
      for (const x of loggedSets(log)) {
        if (x.weight == null || x.weight <= 0) continue;
        const b = best[code];
        if (!b || x.weight > b.weight || (x.weight === b.weight && (x.reps ?? 0) > (b.reps ?? 0))) {
          best[code] = { code, name: names[code] ?? b?.name ?? code, weight: x.weight, reps: x.reps, date: s.date };
        }
      }
    }
  }
  return Object.values(best).sort((a, b) => b.date.localeCompare(a.date));
}

/** Every exercise the user has used, for pickers. */
export function knownExercises(base: { code: string; name: string }[]): { code: string; name: string }[] {
  const map = new Map(base.map((e) => [e.code, e.name]));
  for (const p of Object.values(st().programs)) for (const w of p.workouts) for (const e of w.exercises) if (!map.has(e.code)) map.set(e.code, e.name);
  for (const s of Object.values(st().sessions)) for (const e of s.plan) if (!map.has(e.code)) map.set(e.code, e.name);
  return [...map].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
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
