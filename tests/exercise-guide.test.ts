import { describe, expect, it } from "vitest";
import { BREATHING, EXERCISE_VIDEOS, videoFor } from "../src/data/exercise-guide";
import { allExerciseCodes } from "../src/data/workout-data";

describe("exercise guidance (supplementary, not from the PDF)", () => {
  it("has breathing guidance for every exercise in the programme", () => {
    for (const code of allExerciseCodes()) {
      expect(BREATHING[code], code).toBeDefined();
      expect(BREATHING[code]!.in.length).toBeGreaterThan(0);
      expect(BREATHING[code]!.out.length).toBeGreaterThan(0);
    }
  });

  it("has no guidance for exercises that aren't in the programme", () => {
    const codes = new Set(allExerciseCodes());
    for (const code of Object.keys(BREATHING)) expect(codes.has(code), code).toBe(true);
    for (const code of Object.keys(EXERCISE_VIDEOS)) expect(codes.has(code), code).toBe(true);
  });

  it("only uses https video URLs, and handles missing ones", () => {
    for (const [code, url] of Object.entries(EXERCISE_VIDEOS)) {
      if (url != null) expect(url, code).toMatch(/^https:\/\//);
    }
    expect(videoFor("not_an_exercise")).toBeNull();
  });
});
