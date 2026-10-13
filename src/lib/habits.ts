/*
 * Habit helpers (pure, unit-tested): weekly goal, streak, and days with nothing logged.
 */
import { addDays, parseISO } from "./utils";

/** Monday–Sunday dates of the week containing `today`. */
export function weekDates(today: string): string[] {
  const d = parseISO(today)!;
  const monday = addDays(today, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Streak: consecutive days with something positive logged (a workout, or a rest day), counting back
 * from today, or from yesterday if today isn't logged yet (so the streak isn't "broken" mid-day).
 */
export function streak(activeDates: Set<string>, today: string): number {
  let day = activeDates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (activeDates.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

/**
 * Past days with nothing logged at all, oldest first: from `since` (or `maxBack` days ago, whichever
 * is later) up to yesterday. Used to ask "did you skip this day?".
 */
export function unloggedDays(logged: Set<string>, since: string | null, today: string, maxBack = 7): string[] {
  if (!since) return [];
  const floor = addDays(today, -maxBack);
  let day = since > floor ? since : floor;
  const out: string[] = [];
  while (day < today) {
    if (!logged.has(day)) out.push(day);
    day = addDays(day, 1);
  }
  return out;
}
