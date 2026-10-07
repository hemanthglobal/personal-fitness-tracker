import { describe, expect, it } from "vitest";
import { BREATHING } from "../src/data/exercise-guide";
import {
  BUILTIN_60, codeForName, programLength, programRef, pplTemplate, shortFor, slotFor, workoutChoices, type CustomProgram,
} from "../src/data/programs";

const custom = (): CustomProgram => ({ ...pplTemplate(), id: "11111111-1111-4111-8111-111111111111", createdAt: "", updatedAt: "" });
const customs = () => { const p = custom(); return { [p.id]: p }; };

describe("programs", () => {
  it("built-in 60 Days to Fit resolves like the PDF calendar", () => {
    const d1 = slotFor(BUILTIN_60, 1, {});
    expect(d1).toMatchObject({ type: "workout", key: "A-light", short: "AL", cycle: 1 });
    expect(d1?.type === "workout" && d1.exercises[0]!.reps).toBe(8);
    expect(slotFor(BUILTIN_60, 3, {})?.type).toBe("rest");
    const d53 = slotFor(BUILTIN_60, 53, {});
    expect(d53?.type === "workout" && d53.exercises[0]!.reps).toBe(8); // cycle 5 heavy
    expect(slotFor(BUILTIN_60, 61, {})).toBeNull();
    expect(programLength(BUILTIN_60, {})).toBe(60);
    expect(workoutChoices(BUILTIN_60, {})).toHaveLength(8);
  });

  it("custom programs repeat their day pattern", () => {
    const ref = programRef(custom().id);
    const c = customs();
    const seq = Array.from({ length: 8 }, (_, i) => { const s = slotFor(ref, i + 1, c)!; return s.type === "rest" ? "rest" : s.key; });
    expect(seq).toEqual(["push", "pull", "legs", "rest", "upper", "lower", "rest", "push"]);
    expect(programLength(ref, c)).toBe(56); // 7 days × 8 weeks
    expect(slotFor(ref, 57, c)).toBeNull();
  });

  it("open-ended custom programs never run out", () => {
    const p = { ...custom(), repeats: null };
    const ref = programRef(p.id);
    expect(programLength(ref, { [p.id]: p })).toBeNull();
    expect(slotFor(ref, 365, { [p.id]: p })).not.toBeNull();
  });

  it("the template only uses exercises that have breathing cues", () => {
    for (const w of pplTemplate().workouts) for (const e of w.exercises) expect(BREATHING[e.code], e.code).toBeDefined();
  });

  it("maps typed names to known codes or stable custom codes", () => {
    const known = [{ code: "bench_press", name: "Bench Press" }];
    expect(codeForName("bench press", known)).toBe("bench_press");
    expect(codeForName("Hip Thrust (barbell)", known)).toBe("custom_hip_thrust_barbell");
    expect(codeForName("Hip Thrust (barbell)", known)).toMatch(/^[a-z0-9_]{2,64}$/);
  });

  it("makes short calendar labels", () => {
    expect(shortFor("Push")).toBe("Push");
    expect(shortFor("Upper body")).toBe("UB");
  });
});
