/*
 * Flexible scheduling for a program run. A program is a SEQUENCE of days, not fixed dates.
 *
 * - Done / skipped days sit on the date they happened.
 * - "Next up" is the first day that is neither done nor skipped.
 * - Remaining days are projected one per calendar day from today (tomorrow if a day was already
 *   DONE today; skipping a rest day today doesn't count, so the next workout is still today).
 * - Taking a day off therefore pushes the plan (and the finish date) back.
 *
 * Pure functions (no DOM / store access) so they're unit-tested directly.
 */
import { addDays, daysBetween } from "./utils";

export type RunDayStatus = "done" | "skipped";
export interface RunDay { status: RunDayStatus; date: string; sessionId: string | null }

export interface RunLike {
  startDate: string;
  status: "active" | "finished" | "ended";
  days: Record<number, RunDay | undefined>;
}

export interface Projection {
  /** Date (YYYY-MM-DD) per day: actual date if done/skipped, projected otherwise (active runs only). */
  dates: Record<number, string>;
  /** First day not yet done or skipped (null when complete). */
  next: number | null;
  /** Last day's actual/projected date; null for open-ended programs. */
  finish: string | null;
  /** Original finish if every day had been done on schedule; null for open-ended programs. */
  plannedFinish: string | null;
  /** Days the finish moved vs the original plan. */
  slip: number;
}

/** Days to project ahead for open-ended programs. */
export const OPEN_HORIZON = 60;

export function projectRun(run: RunLike, length: number | null, today: string): Projection {
  const resolvedDays = Object.keys(run.days).map(Number).filter((n) => run.days[n]);
  const maxResolved = resolvedDays.length ? Math.max(...resolvedDays) : 0;
  const lastDay = length ?? maxResolved + OPEN_HORIZON;

  const doneToday = resolvedDays.some((n) => run.days[n]!.status === "done" && run.days[n]!.date === today);
  let cursor = today < run.startDate ? run.startDate : doneToday ? addDays(today, 1) : today;

  const dates: Record<number, string> = {};
  let next: number | null = null;
  let finish: string | null = null;
  for (let n = 1; n <= lastDay; n++) {
    const d = run.days[n];
    if (d) {
      dates[n] = d.date;
    } else {
      next ??= n;
      if (run.status !== "active") continue;
      dates[n] = cursor;
      cursor = addDays(cursor, 1);
    }
    if (dates[n] && (!finish || dates[n]! > finish)) finish = dates[n]!;
  }
  if (length == null) return { dates, next, finish: null, plannedFinish: null, slip: 0 };
  const plannedFinish = addDays(run.startDate, length - 1);
  return { dates, next, finish, plannedFinish, slip: finish ? daysBetween(plannedFinish, finish) : 0 };
}

/** Timestamp to store when the user says something happened on a given date (noon local time). */
export function atDate(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12).toISOString();
}
