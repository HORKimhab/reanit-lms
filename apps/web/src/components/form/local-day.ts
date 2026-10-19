/** Hours, minutes, seconds and milliseconds into a day. */
type TimeOfDay = readonly [number, number, number, number];

/** The first moment of a day. */
const START_OF_DAY: TimeOfDay = [0, 0, 0, 0];
/** The last millisecond of a day. */
export const END_OF_DAY: TimeOfDay = [23, 59, 59, 999];

const DIGITS_IN_MONTH_OR_DAY = 2;

/**
 * Turns a date input's day into a moment in the browser's own time zone.
 *
 * @param day - The input's value, `YYYY-MM-DD`.
 * @param time - The time of day; the day's start by default.
 * @returns The ISO date-time, or null when the value is not a date.
 * @example
 * localDayToIso("2026-12-31", END_OF_DAY); // "2026-12-31T16:59:59.999Z" in Phnom Penh
 */
export function localDayToIso(day: string, time: TimeOfDay = START_OF_DAY): string | null {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return null;
  return new Date(year, month - 1, date, ...time).toISOString();
}

/**
 * Turns a moment into the day a date input shows for it, in the browser's own time zone.
 *
 * @param iso - An ISO date-time.
 * @returns `YYYY-MM-DD`.
 * @example
 * isoToLocalDay("2026-12-01T00:00:00.000Z"); // "2026-12-01" in UTC
 */
export function isoToLocalDay(iso: string): string {
  const moment = new Date(iso);
  const [month, date] = [moment.getMonth() + 1, moment.getDate()].map((part) => String(part).padStart(DIGITS_IN_MONTH_OR_DAY, "0"));
  return `${moment.getFullYear()}-${month}-${date}`;
}
