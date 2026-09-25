export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Escape user/text content for innerHTML templates. */
export const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]!);

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const todayISO = (): string => toISO(new Date());

/** Parse "YYYY-MM-DD" to a local Date, or null if invalid. */
export function parseISO(s: unknown): Date | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

/** Whole calendar days from a to b (DST-safe). */
export function daysBetween(aISO: string, bISO: string): number {
  const a = parseISO(aISO), b = parseISO(bISO);
  if (!a || !b) return NaN;
  return Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000,
  );
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Programme day for a date. Day 1 = start date. <1 before start, >60 after the end. Weekends are not skipped. */
export function getTodayProgramDay(startDate: string, currentDate: string): number {
  return daysBetween(startDate, currentDate) + 1;
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString(undefined, opts) : "";
}
export const fmtLongDate = (iso: string) => fmtDate(iso, { day: "numeric", month: "long", year: "numeric" });

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const plural = (n: number, word: string, pl = word + "s") => `${n} ${n === 1 ? word : pl}`;

export const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
