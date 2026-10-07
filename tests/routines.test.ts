import { describe, expect, it } from "vitest";
import { expandSteps, getRoutine, PREP_SECONDS, routineSeconds, STRETCHES, WARMUPS } from "../src/data/routines";

describe("warm-up & stretching routines", () => {
  it("has a warm-up and a stretch for every workout, plus a full-body stretch", () => {
    for (const k of ["A", "B", "C", "D"]) {
      expect(getRoutine("warmup", k)?.kind).toBe("warmup");
      expect(getRoutine("stretch", k)?.kind).toBe("stretch");
    }
    expect(getRoutine("stretch", "full")).not.toBeNull();
    expect(getRoutine("warmup", "full")?.kind).toBe("warmup"); // general warm-up for custom programs
    expect(getRoutine("nope", "A")).toBeNull();
  });

  it("uses positive whole-second durations and non-empty cues", () => {
    for (const r of [...Object.values(WARMUPS), ...Object.values(STRETCHES)]) {
      for (const m of r.moves) {
        expect(Number.isInteger(m.seconds) && m.seconds > 0, m.name).toBe(true);
        expect(m.cue.length, m.name).toBeGreaterThan(0);
      }
    }
  });

  it("expands each-side moves into a Left and a Right step", () => {
    const steps = expandSteps(WARMUPS.D);
    const swings = steps.filter((s) => s.name === "Leg swings, front to back");
    expect(swings.map((s) => s.side)).toEqual(["Left", "Right"]);
    expect(steps.find((s) => s.name === "Bodyweight squats")?.side).toBeUndefined();
  });

  it("keeps sessions short enough to actually use (2–10 min)", () => {
    for (const r of [...Object.values(WARMUPS), ...Object.values(STRETCHES)]) {
      const sec = routineSeconds(r);
      expect(sec, r.title).toBeGreaterThanOrEqual(120);
      expect(sec, r.title).toBeLessThanOrEqual(600);
      expect(sec).toBe(expandSteps(r).reduce((t, s) => t + s.seconds + PREP_SECONDS, 0));
    }
  });
});
