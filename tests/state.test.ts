import { describe, expect, it } from "vitest";
import { normalizeState, STATE_VERSION } from "../src/lib/state";

const valid = () => ({
  version: STATE_VERSION,
  settings: { startDate: "2026-09-25", weightUnit: "kg", theme: "system" },
  days: { 1: { completed: true, completedAt: "2026-09-25T10:00:00.000Z" } },
  workouts: { 1: { db_lateral_raise: { sets: [{ weight: 10, reps: 8, done: true }], notes: "ok" } } },
  bodyWeight: [{ date: "2026-09-25", weight: 80, notes: "" }],
  shopping: {},
});

describe("backup / cache validation", () => {
  it("accepts a valid backup", () => {
    const s = normalizeState(valid());
    expect(s.days[1]?.completed).toBe(true);
    expect(s.workouts[1]?.db_lateral_raise?.sets[0]).toEqual({ weight: 10, reps: 8, done: true });
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["missing version", { ...valid(), version: undefined }],
    ["a newer version", { ...valid(), version: STATE_VERSION + 1 }],
    ["an invalid start date", { ...valid(), settings: { startDate: "2026-02-31" } }],
    ["missing days", { ...valid(), days: undefined }],
  ])("rejects %s", (_, input) => {
    expect(() => normalizeState(input)).toThrow();
  });

  it("drops out-of-range days and invalid values instead of crashing", () => {
    const raw = valid() as Record<string, unknown>;
    raw.days = { 0: { completed: true }, 61: { completed: true }, 5: { completed: true } };
    raw.workouts = { 2: { pushup: { sets: [{ weight: -5, reps: 2.5, done: true }] } } };
    raw.bodyWeight = [{ date: "nope", weight: 80 }, { date: "2026-09-26", weight: -1 }];
    const s = normalizeState(raw);
    expect(Object.keys(s.days)).toEqual(["5"]);
    expect(s.workouts[2]?.pushup?.sets[0]).toEqual({ weight: null, reps: null, done: true });
    expect(s.bodyWeight).toEqual([]);
  });
});
