/*
 * Programs: the built-in "60 Days to Fit" (from the PDF) plus user-made programs.
 *
 * A program is a sequence of days. Each day is a workout or a rest. "60 Days to Fit" is a fixed
 * 60-day sequence whose reps depend on the cycle (see workout-data.ts). A custom program is a
 * repeating day pattern (e.g. Push, Pull, Legs, Rest, Upper, Lower, Rest), repeated N times or
 * until the user stops.
 */
import { BREATHING } from "./exercise-guide";
import { getSchedule, getTargetReps, TOTAL_DAYS, WORKOUTS } from "./workout-data";
import type { Intensity, WorkoutCode } from "../types/workout";

export const BUILTIN_60 = "builtin:60days";

export interface ProgramExercise {
  code: string;
  name: string;
  sets: number;
  /** Target reps; null = to failure. */
  reps: number | null;
  superset?: string;
}

export interface ProgramWorkout {
  key: string;
  name: string;
  /** Up to 4 characters for calendar cells, e.g. "Push", "AL". */
  short: string;
  exercises: ProgramExercise[];
}

export interface CustomProgram {
  id: string;
  name: string;
  workouts: ProgramWorkout[];
  /** Workout key per day, or null for rest. Repeats. */
  pattern: (string | null)[];
  /** Times the pattern repeats; null = until you stop. */
  repeats: number | null;
  createdAt: string;
  updatedAt: string;
}

/** One resolved programme day. */
export type Slot =
  | { type: "rest"; day: number; label: string; short: "Rest" }
  | {
      type: "workout";
      day: number;
      key: string;
      name: string;
      short: string;
      exercises: ProgramExercise[];
      /** 60 Days to Fit only. */
      intensity?: Intensity;
      cycle?: number;
      letter?: WorkoutCode;
    };

export const programRef = (customId: string) => `custom:${customId}`;
export const customIdOf = (ref: string) => (ref.startsWith("custom:") ? ref.slice(7) : null);

/* ---------------------------------------------------------------------------
 * Built-in: 60 Days to Fit
 * ------------------------------------------------------------------------- */

const builtinKey = (letter: string, intensity: Intensity) => `${letter}-${intensity}`;

function builtinSlot(day: number): Slot | null {
  const s = getSchedule(day);
  if (!s) return null;
  if (s.type === "rest") return { type: "rest", day, label: "Rest day", short: "Rest" };
  return {
    type: "workout",
    day,
    key: builtinKey(s.workout, s.intensity),
    name: s.name,
    short: `${s.workout}${s.intensity === "light" ? "L" : "H"}`,
    intensity: s.intensity,
    cycle: s.cycle,
    letter: s.workout,
    exercises: s.exercises.map((e) => ({ ...e, reps: getTargetReps(s.intensity, s.cycle, e) })),
  };
}

/** The 8 distinct workouts of the built-in programme (for "swap workout"). */
function builtinWorkoutChoices(): { key: string; name: string; short: string }[] {
  const out: { key: string; name: string; short: string }[] = [];
  for (const letter of ["A", "B", "C", "D"] as const) {
    for (const intensity of ["light", "heavy"] as const) {
      out.push({ key: builtinKey(letter, intensity), name: `${WORKOUTS[letter].name} · ${intensity === "light" ? "Light" : "Heavy"}`, short: `${letter}${intensity === "light" ? "L" : "H"}` });
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Template: Push / Pull / Legs + Upper / Lower (general template, not from the PDF)
 * ------------------------------------------------------------------------- */

const ex = (code: string, name: string, sets: number, reps: number | null): ProgramExercise => ({ code, name, sets, reps });

export function pplTemplate(): Omit<CustomProgram, "id" | "createdAt" | "updatedAt"> {
  return {
    name: "Push / Pull / Legs + Upper / Lower",
    repeats: 8,
    pattern: ["push", "pull", "legs", null, "upper", "lower", null],
    workouts: [
      { key: "push", name: "Push", short: "Push", exercises: [
        ex("bench_press", "Bench Press", 4, 8), ex("single_arm_db_overhead_press", "Single-arm Dumbbell Overhead Press", 3, 10),
        ex("incline_db_press", "Incline Dumbbell Press", 3, 10), ex("db_lateral_raise", "Dumbbell Lateral Raise", 3, 12),
        ex("rope_pushdown", "Rope Pushdown", 3, 12),
      ] },
      { key: "pull", name: "Pull", short: "Pull", exercises: [
        ex("pullup", "Pullup", 3, null), ex("barbell_bentover_row", "Barbell Bentover Row", 4, 8),
        ex("lat_pulldown", "Lat Pulldown", 3, 10), ex("db_rear_delt_flye", "Dumbbell Rear-delt Flye", 3, 12),
        ex("straight_bar_curl", "Straight-bar Curl", 3, 10),
      ] },
      { key: "legs", name: "Legs", short: "Legs", exercises: [
        ex("squat", "Squat", 4, 8), ex("leg_press", "Leg Press", 3, 10), ex("leg_curl", "Leg Curl", 3, 12),
        ex("walking_lunge", "Walking Lunge", 3, 10), ex("standing_calf_raise", "Standing Calf Raise", 4, 12),
      ] },
      { key: "upper", name: "Upper body", short: "Upr", exercises: [
        ex("flat_db_press", "Flat Dumbbell Press", 4, 8), ex("single_arm_db_row", "Single-arm Dumbbell Row", 4, 10),
        ex("single_arm_db_overhead_press", "Single-arm Dumbbell Overhead Press", 3, 10), ex("lat_pulldown", "Lat Pulldown", 3, 10),
        ex("seated_db_curl", "Seated Dumbbell Curl", 3, 12), ex("db_overhead_extension", "Dumbbell Overhead Extension", 3, 12),
      ] },
      { key: "lower", name: "Lower body", short: "Lwr", exercises: [
        ex("deadlift", "Deadlift", 4, 6), ex("walking_lunge", "Walking Lunge", 3, 10), ex("leg_extension", "Leg Extension", 3, 12),
        ex("leg_curl", "Leg Curl", 3, 12), ex("seated_calf_raise", "Seated Calf Raise", 4, 15),
      ] },
    ],
  };
}

/* ---------------------------------------------------------------------------
 * Resolving days
 * ------------------------------------------------------------------------- */

/** Total days, or null for an open-ended program. */
export function programLength(ref: string, customs: Record<string, CustomProgram>): number | null {
  if (ref === BUILTIN_60) return TOTAL_DAYS;
  const p = customs[customIdOf(ref) ?? ""];
  if (!p) return 0;
  return p.repeats == null ? null : p.pattern.length * p.repeats;
}

export function programName(ref: string, customs: Record<string, CustomProgram>): string {
  if (ref === BUILTIN_60) return "60 Days to Fit";
  return customs[customIdOf(ref) ?? ""]?.name ?? "Deleted program";
}

/** The workout/rest for day N (1-based) of a program, or null if out of range / unknown. */
export function slotFor(ref: string, day: number, customs: Record<string, CustomProgram>): Slot | null {
  if (!Number.isInteger(day) || day < 1) return null;
  if (ref === BUILTIN_60) return builtinSlot(day);
  const p = customs[customIdOf(ref) ?? ""];
  if (!p || !p.pattern.length) return null;
  const len = programLength(ref, customs);
  if (len != null && day > len) return null;
  const key = p.pattern[(day - 1) % p.pattern.length];
  if (key == null) return { type: "rest", day, label: "Rest day", short: "Rest" };
  const w = p.workouts.find((x) => x.key === key);
  if (!w) return { type: "rest", day, label: "Rest day", short: "Rest" };
  return { type: "workout", day, key: w.key, name: w.name, short: w.short, exercises: w.exercises };
}

/** Distinct workouts in a program, for the swap picker. */
export function workoutChoices(ref: string, customs: Record<string, CustomProgram>) {
  if (ref === BUILTIN_60) return builtinWorkoutChoices();
  return (customs[customIdOf(ref) ?? ""]?.workouts ?? []).map((w) => ({ key: w.key, name: w.name, short: w.short }));
}

/* ---------------------------------------------------------------------------
 * Exercise library (built-in exercises + anything the user has added)
 * ------------------------------------------------------------------------- */

export function builtinExercises(): { code: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const w of Object.values(WORKOUTS)) for (const e of [...w.light, ...w.heavy]) seen.set(e.code, e.name);
  return [...seen].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Stable code for a typed exercise name: reuse a known one, else a custom_ slug. */
export function codeForName(name: string, known: { code: string; name: string }[]): string {
  const n = name.trim().toLowerCase();
  const hit = known.find((k) => k.name.toLowerCase() === n);
  if (hit) return hit.code;
  const slug = n.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 56) || "exercise";
  return `custom_${slug}`;
}

export const hasBreathing = (code: string) => !!BREATHING[code];

/** Short label from a workout name, for calendar cells. */
export function shortFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((w) => w[0]!.toUpperCase()).join("").slice(0, 3);
  return (words[0] ?? "W").slice(0, 4).replace(/^./, (c) => c.toUpperCase());
}
