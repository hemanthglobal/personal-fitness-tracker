import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allExerciseCodes, CYCLE_LENGTH, getSchedule, getTargetReps, TOTAL_DAYS, WORKOUTS } from "../src/data/workout-data";
import { getTodayProgramDay } from "../src/lib/utils";
import type { WorkoutSchedule } from "../src/types/workout";

const workout = (day: number) => {
  const s = getSchedule(day);
  if (!s || s.type !== "workout") throw new Error(`Day ${day} is not a workout`);
  return s as WorkoutSchedule;
};

describe("60-day calendar (PDF page 3)", () => {
  const pattern: [number, string][] = [
    [1, "A light"], [2, "B heavy"], [3, "rest"], [4, "C light"], [5, "D heavy"], [6, "rest"],
    [7, "A heavy"], [8, "B light"], [9, "rest"], [10, "C heavy"], [11, "D light"], [12, "rest"],
  ];
  const label = (day: number) => {
    const s = getSchedule(day)!;
    return s.type === "rest" ? "rest" : `${s.workout} ${s.intensity}`;
  };

  it.each(pattern)("day %i is %s", (day, expected) => expect(label(day)).toBe(expected));

  it("repeats the 12-day pattern in every cycle", () => {
    for (let day = 13; day <= TOTAL_DAYS; day++) expect(label(day)).toBe(label(((day - 1) % 12) + 1));
  });

  it.each([
    [1, 1, "A light"], [2, 1, "B heavy"], [3, 1, "rest"], [12, 1, "rest"],
    [13, 2, "A light"], [24, 2, "rest"], [25, 3, "A light"], [36, 3, "rest"],
    [37, 4, "A light"], [48, 4, "rest"], [49, 5, "A light"], [60, 5, "rest"],
  ])("day %i is cycle %i, %s", (day, cycle, expected) => {
    expect(getSchedule(day)!.cycle).toBe(cycle);
    expect(label(day)).toBe(expected);
  });

  it("has 8 workouts and 4 rest days per cycle, 40/20 overall", () => {
    let w = 0, r = 0;
    for (let d = 1; d <= TOTAL_DAYS; d++) getSchedule(d)!.type === "rest" ? r++ : w++;
    expect([w, r]).toEqual([40, 20]);
    for (let c = 0; c < 5; c++) {
      const days = Array.from({ length: CYCLE_LENGTH }, (_, i) => getSchedule(c * 12 + i + 1)!);
      expect(days.filter((d) => d.type === "rest")).toHaveLength(4);
    }
  });

  it("trains each body part once light and once heavy per cycle", () => {
    const seen = Array.from({ length: 12 }, (_, i) => getSchedule(i + 1)!).filter((s) => s.type === "workout").map((s) => `${(s as WorkoutSchedule).workout}-${(s as WorkoutSchedule).intensity}`);
    expect(seen.sort()).toEqual(["A-heavy", "A-light", "B-heavy", "B-light", "C-heavy", "C-light", "D-heavy", "D-light"]);
  });

  it("returns null outside 1–60", () => {
    expect(getSchedule(0)).toBeNull();
    expect(getSchedule(61)).toBeNull();
    expect(getSchedule(1.5)).toBeNull();
  });
});

describe("rep progression (PDF pages 4–5)", () => {
  it.each([[1, 8, 4], [2, 9, 5], [3, 10, 6], [4, 11, 7], [5, 12, 8]])("cycle %i: light %i, heavy %i", (cycle, light, heavy) => {
    expect(getTargetReps("light", cycle)).toBe(light);
    expect(getTargetReps("heavy", cycle)).toBe(heavy);
  });

  it("applies to scheduled days", () => {
    expect(getTargetReps(workout(13).intensity, workout(13).cycle)).toBe(9); // cycle 2 light
    expect(getTargetReps(workout(53).intensity, workout(53).cycle)).toBe(8); // cycle 5 heavy
  });

  it("keeps pullups to failure", () => {
    for (const ex of [...WORKOUTS.B.light, ...WORKOUTS.B.heavy].filter((e) => e.code === "pullup")) {
      expect(getTargetReps("light", 3, ex)).toBeNull();
    }
  });
});

describe("exercise data (PDF pages 4–5)", () => {
  it("matches the PDF exercise counts and set totals", () => {
    const summary = Object.fromEntries(
      Object.entries(WORKOUTS).flatMap(([k, w]) => [
        [`${k} light`, w.light.map((e) => e.sets).join(",")],
        [`${k} heavy`, w.heavy.map((e) => e.sets).join(",")],
      ]),
    );
    expect(summary).toEqual({
      "A light": "3,3,3,3,3,3,3", "A heavy": "3,3,3,3",
      "B light": "3,3,3,3,3,3,3,3", "B heavy": "2,5,3,3,3",
      "C light": "2,3,3,3,3,3,3,3,3", "C heavy": "2,5,5,5,5",
      "D light": "3,3,3,3,3,3,3", "D heavy": "5,5,5,5",
    });
  });

  it("has supersets only on light days, always as consecutive pairs", () => {
    for (const w of Object.values(WORKOUTS)) {
      expect(w.heavy.some((e) => e.superset)).toBe(false);
      const groups: Record<string, number[]> = {};
      w.light.forEach((e, i) => { if (e.superset) (groups[e.superset] ??= []).push(i); });
      for (const idx of Object.values(groups)) {
        expect(idx).toHaveLength(2);
        expect(idx[1]! - idx[0]!).toBe(1);
      }
    }
  });

  it("uses unique codes within each workout", () => {
    for (const w of Object.values(WORKOUTS)) for (const list of [w.light, w.heavy]) {
      expect(new Set(list.map((e) => e.code)).size).toBe(list.length);
    }
  });

  it("keeps exercise codes in sync with the database seed", () => {
    const sql = readFileSync(new URL("../supabase/migrations/0001_initial_schema.sql", import.meta.url), "utf8");
    const seed = sql.slice(sql.indexOf("insert into public.exercise_codes"), sql.indexOf(";", sql.indexOf("insert into public.exercise_codes")));
    const dbCodes = [...seed.matchAll(/\('([a-z0-9_]+)'\)/g)].map((m) => m[1]).sort();
    expect(dbCodes).toEqual(allExerciseCodes());
  });
});

describe("start date logic", () => {
  it("day 1 is the start date and weekends aren't skipped", () => {
    expect(getTodayProgramDay("2026-09-25", "2026-09-25")).toBe(1);
    expect(getTodayProgramDay("2026-09-25", "2026-09-26")).toBe(2); // Saturday
    expect(getTodayProgramDay("2026-09-25", "2026-09-27")).toBe(3); // Sunday
    expect(getTodayProgramDay("2026-09-25", "2026-11-23")).toBe(60);
  });
  it("is DST-safe", () => {
    expect(getTodayProgramDay("2026-03-01", "2026-04-01")).toBe(32);
    expect(getTodayProgramDay("2026-10-20", "2026-11-10")).toBe(22);
  });
  it("goes below 1 before the start and above 60 after the end", () => {
    expect(getTodayProgramDay("2026-09-25", "2026-09-24")).toBe(0);
    expect(getTodayProgramDay("2026-09-25", "2026-11-24")).toBe(61);
  });
});
