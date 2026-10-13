import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QUOTES, quoteForDate } from "../src/data/quotes";
import { streak, unloggedDays, weekDates } from "../src/lib/habits";
import { normalizeState, normNotify, STATE_VERSION } from "../src/lib/state";

describe("weekly goal + streak", () => {
  it("weeks run Monday to Sunday", () => {
    // 2026-10-13 is a Tuesday.
    expect(weekDates("2026-10-13")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(weekDates("2026-10-18")[0]).toBe("2026-10-12"); // Sunday belongs to the same week
  });

  it("counts consecutive active days, not breaking on a not-yet-logged today", () => {
    const days = new Set(["2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(streak(days, "2026-10-13")).toBe(3); // today not logged yet
    expect(streak(new Set([...days, "2026-10-13"]), "2026-10-13")).toBe(4);
    expect(streak(new Set(["2026-10-10"]), "2026-10-13")).toBe(0); // gap yesterday
  });
});

describe("days with nothing logged", () => {
  it("lists past days without anything logged, oldest first, from tracking start", () => {
    const logged = new Set(["2026-10-10", "2026-10-12"]);
    expect(unloggedDays(logged, "2026-10-09", "2026-10-13")).toEqual(["2026-10-09", "2026-10-11"]);
  });
  it("looks back at most a week and never asks about today or before tracking began", () => {
    expect(unloggedDays(new Set(), "2026-09-01", "2026-10-13", 7)).toHaveLength(7);
    expect(unloggedDays(new Set(), "2026-10-13", "2026-10-13")).toEqual([]);
    expect(unloggedDays(new Set(), null, "2026-10-13")).toEqual([]);
  });
});

describe("motivation quotes", () => {
  it("picks the same quote for the same date", () => {
    expect(quoteForDate("2026-10-13")).toBe(quoteForDate("2026-10-13"));
    expect(QUOTES).toContain(quoteForDate("2026-10-14"));
  });
  it("matches the list in the send-reminders Edge Function exactly", () => {
    const fn = readFileSync(new URL("../supabase/functions/send-reminders/index.ts", import.meta.url), "utf8");
    const block = fn.slice(fn.indexOf("const QUOTES"), fn.indexOf("];", fn.indexOf("const QUOTES")));
    const fnQuotes = [...block.matchAll(/^\s*"(.*)",$/gm)].map((m) => m[1]);
    expect(fnQuotes).toEqual(QUOTES);
  });
});

describe("reminder settings + marks in state", () => {
  it("defaults and validates reminder settings", () => {
    expect(normNotify(undefined)).toMatchObject({ enabled: false, quoteTime: "18:00", gymTime: "20:00", remindBefore: 30, skipCheckTime: "22:00" });
    expect(normNotify({ gymTime: "25:00", remindBefore: 999, quoteTime: "07:15" })).toMatchObject({ gymTime: "20:00", remindBefore: 30, quoteTime: "07:15" });
  });
  it("keeps valid day marks and the weekly goal", () => {
    const s = normalizeState({
      version: STATE_VERSION, settings: { weeklyGoal: 5 }, runs: {}, sessions: {},
      marks: { "2026-10-11": "skipped", "2026-10-12": "rest", nope: "skipped", "2026-10-13": "bad" },
    });
    expect(s.marks).toEqual({ "2026-10-11": "skipped", "2026-10-12": "rest" });
    expect(s.settings.weeklyGoal).toBe(5);
  });
});
