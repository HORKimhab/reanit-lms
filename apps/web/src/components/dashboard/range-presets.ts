/** The ranges the analytics filter offers in one click, in days up to today. */
export const RANGE_PRESETS = [7, 30, 90] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Length of `YYYY-MM-DD`, the start of an ISO date-time. */
const ISO_DAY_LENGTH = 10;

/**
 * Names the UTC day a moment falls on, as reports and date inputs take it.
 *
 * @param moment The moment.
 * @returns `YYYY-MM-DD`.
 * @example
 * isoDay(new Date("2026-10-20T23:00:00Z")); // "2026-10-20"
 */
export function isoDay(moment: Date): string {
  return moment.toISOString().slice(0, ISO_DAY_LENGTH);
}

/**
 * Builds the range of a preset: that many UTC days up to today, today included.
 *
 * @param days The preset's length.
 * @param now The current time.
 * @returns The first and last day, `YYYY-MM-DD`.
 * @example
 * presetRange(7, new Date("2026-10-20T10:00:00Z")); // { from: "2026-10-14", to: "2026-10-20" }
 */
export function presetRange(days: number, now: Date): { from: string; to: string } {
  return { from: isoDay(new Date(now.getTime() - (days - 1) * DAY_MS)), to: isoDay(now) };
}
