import type { OrderLine } from "./ports";
import { minorStep, type Currency } from "./rules";

/**
 * Splits what an order charges across its courses in equal shares, so sales per course add up to
 * the amount paid. Shares are whole steps of the currency (whole riel); the first courses take any
 * remainder.
 *
 * @param total What the order charges, in minor units; a whole number of the currency's steps.
 * @param courseIds The courses, in order; at least one.
 * @param currency The order's currency.
 * @returns One line per course, adding up to `total`.
 * @example
 * splitAcrossCourses(1000, ["a", "b", "c"], "USD"); // a: 334, b: 333, c: 333
 */
export function splitAcrossCourses(total: number, courseIds: string[], currency: Currency): OrderLine[] {
  const step = minorStep(currency);
  const steps = total / step;
  const share = Math.floor(steps / courseIds.length);
  const remainder = steps % courseIds.length;
  return courseIds.map((courseId, index) => ({ courseId, amount: (share + (index < remainder ? 1 : 0)) * step }));
}
