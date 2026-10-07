import { describe, expect, it } from "vitest";
import { BUILTIN_60 } from "../src/data/programs";
import { normalizeState, STATE_VERSION } from "../src/lib/state";

const v3 = () => ({
  version: STATE_VERSION,
  settings: { weightUnit: "kg", theme: "system", sound: true },
  programs: {},
  runs: {
    r1: { programRef: BUILTIN_60, name: "60 Days to Fit", startDate: "2026-09-25", status: "active", endedAt: null, createdAt: "2026-09-25T08:00:00.000Z",
      days: { 1: { status: "done", date: "2026-09-25", sessionId: "s1" }, 3: { status: "skipped", date: "2026-09-26", sessionId: null } } },
  },
  activeRunId: "r1",
  sessions: {
    s1: { date: "2026-09-25", runId: "r1", day: 1, workoutKey: "A-light", title: "Shoulders / Traps", status: "done", completedAt: null,
      plan: [{ code: "db_lateral_raise", name: "Dumbbell Lateral Raise", sets: 3, reps: 8 }],
      logs: { db_lateral_raise: { sets: [{ weight: 10, reps: 8, done: true }], notes: "ok" } }, createdAt: "x", updatedAt: "x" },
  },
  bodyWeight: [{ date: "2026-09-25", weight: 80, notes: "" }],
  shopping: {},
});

describe("backup / cache validation (v3)", () => {
  it("accepts a valid backup", () => {
    const s = normalizeState(v3());
    expect(s.activeRunId).toBe("r1");
    expect(s.runs.r1?.days[3]?.status).toBe("skipped");
    expect(s.sessions.s1?.logs.db_lateral_raise?.sets[0]).toEqual({ weight: 10, reps: 8, done: true });
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["missing version", { ...v3(), version: undefined }],
    ["a newer version", { ...v3(), version: STATE_VERSION + 1 }],
    ["missing runs", { ...v3(), runs: undefined }],
  ])("rejects %s", (_, input) => {
    expect(() => normalizeState(input)).toThrow();
  });

  it("drops invalid values instead of crashing", () => {
    const raw = v3() as Record<string, any>;
    raw.sessions.s1.logs = { "BAD CODE": { sets: [] }, pushup: { sets: [{ weight: -5, reps: 2.5, done: true }] } };
    raw.runs.r1.days = { 0: { status: "done", date: "2026-09-25" }, 2: { status: "done", date: "nope" }, 5: { status: "done", date: "2026-09-28" } };
    raw.bodyWeight = [{ date: "nope", weight: 80 }, { date: "2026-09-26", weight: -1 }];
    raw.activeRunId = "missing";
    const s = normalizeState(raw);
    expect(Object.keys(s.sessions.s1!.logs)).toEqual(["pushup"]);
    expect(s.sessions.s1!.logs.pushup!.sets[0]).toEqual({ weight: null, reps: null, done: true });
    expect(Object.keys(s.runs.r1!.days)).toEqual(["5"]);
    expect(s.bodyWeight).toEqual([]);
    expect(s.activeRunId).toBeNull();
  });
});

describe("migration from the old single-programme format (v2)", () => {
  const v2 = {
    version: 2,
    settings: { startDate: "2026-09-25", weightUnit: "lb", theme: "dark" },
    days: { 1: { completed: true, completedAt: "2026-09-25T10:00:00.000Z" }, 3: { completed: true, completedAt: null } },
    workouts: { 1: { db_lateral_raise: { sets: [{ weight: 10, reps: 8, done: true }], notes: "" } }, 2: { pullup: { sets: [{ weight: null, reps: 6, done: true }] } } },
    bodyWeight: [],
  };

  it("turns the old programme into a 60 Days to Fit run with dated sessions", () => {
    const s = normalizeState(v2);
    const run = s.runs[s.activeRunId!]!;
    expect(run.programRef).toBe(BUILTIN_60);
    expect(run.startDate).toBe("2026-09-25");
    expect(Object.keys(run.days)).toEqual(["1", "3"]);
    const sessions = Object.values(s.sessions);
    expect(sessions).toHaveLength(2);
    const day1 = sessions.find((x) => x.day === 1)!;
    expect(day1.status).toBe("done");
    expect(day1.workoutKey).toBe("A-light");
    expect(day1.logs.db_lateral_raise!.sets[0]!.weight).toBe(10);
    expect(run.days[1]!.sessionId).toBe(day1.id);
    expect(sessions.find((x) => x.day === 2)!.status).toBe("in_progress");
    expect(s.settings.weightUnit).toBe("lb");
    expect(s.settings.theme).toBe("dark");
  });
});
