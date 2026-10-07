import { describe, expect, it } from "vitest";
import { projectRun, type RunLike } from "../src/lib/schedule";

const run = (days: RunLike["days"] = {}, startDate = "2026-10-01"): RunLike => ({ startDate, status: "active", days });

describe("flexible schedule (plan moves with you)", () => {
  it("projects one day per calendar day from the start date", () => {
    const p = projectRun(run(), 60, "2026-10-01");
    expect(p.next).toBe(1);
    expect(p.dates[1]).toBe("2026-10-01");
    expect(p.dates[2]).toBe("2026-10-02");
    expect(p.finish).toBe("2026-11-29");
    expect(p.slip).toBe(0);
  });

  it("skipping a day pushes the rest back and moves the finish date", () => {
    // Day 1 done on the 1st, nothing on the 2nd, today is the 3rd.
    const p = projectRun(run({ 1: { status: "done", date: "2026-10-01", sessionId: null } }), 60, "2026-10-03");
    expect(p.next).toBe(2);
    expect(p.dates[2]).toBe("2026-10-03");
    expect(p.slip).toBe(1);
  });

  it("after training today, the next day is planned for tomorrow", () => {
    const p = projectRun(run({ 1: { status: "done", date: "2026-10-01", sessionId: null } }), 60, "2026-10-01");
    expect(p.next).toBe(2);
    expect(p.dates[2]).toBe("2026-10-02");
  });

  it("skipping a rest day today keeps the next workout today", () => {
    const days = {
      1: { status: "done" as const, date: "2026-10-01", sessionId: null },
      2: { status: "done" as const, date: "2026-10-02", sessionId: null },
      3: { status: "skipped" as const, date: "2026-10-03", sessionId: null },
    };
    const p = projectRun(run(days), 60, "2026-10-03");
    expect(p.next).toBe(4);
    expect(p.dates[4]).toBe("2026-10-03");
    expect(p.slip).toBe(-1); // two days on one date: the plan now finishes a day sooner
  });

  it("days done out of order (swapped workouts) keep their own dates", () => {
    const p = projectRun(run({ 5: { status: "done", date: "2026-10-01", sessionId: null } }), 60, "2026-10-02");
    expect(p.next).toBe(1);
    expect(p.dates[5]).toBe("2026-10-01");
    expect(p.dates[1]).toBe("2026-10-02");
    expect(p.dates[6]).toBe("2026-10-06"); // 1,2,3,4 then 6 (5 already done)
  });

  it("before the start date, projects from the start date", () => {
    const p = projectRun(run({}, "2026-10-10"), 60, "2026-10-01");
    expect(p.dates[1]).toBe("2026-10-10");
  });

  it("open-ended programs project ahead without a finish date", () => {
    const p = projectRun(run(), null, "2026-10-01");
    expect(p.finish).toBeNull();
    expect(p.dates[30]).toBe("2026-10-30");
  });

  it("ended runs don't project anything", () => {
    const p = projectRun({ ...run({ 1: { status: "done", date: "2026-10-01", sessionId: null } }), status: "ended" }, 60, "2026-10-05");
    expect(p.dates[2]).toBeUndefined();
    expect(p.dates[1]).toBe("2026-10-01");
  });
});
