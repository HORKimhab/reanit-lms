// Keeps the pre-aggregated dashboard tables current, inside the transaction of the event they count.
import type { SchoolTransaction } from "./tenant";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Truncates a time to its UTC day, the key of the daily stats rows.
 *
 * @param at The time.
 * @returns Midnight UTC of that day.
 */
function utcDay(at: Date): Date {
  return new Date(Math.floor(at.getTime() / MS_PER_DAY) * MS_PER_DAY);
}

/**
 * Counts one paid order item in its course's sales for the day.
 *
 * @param tx Transaction scoped to the school.
 * @param sale The sale.
 * @param sale.schoolId The school.
 * @param sale.courseId The course sold.
 * @param sale.amount Amount paid, in minor units.
 * @param sale.currency ISO code.
 * @param sale.at When it was paid.
 */
export async function recordSale(
  tx: SchoolTransaction,
  { schoolId, courseId, amount, currency, at }: { schoolId: string; courseId: string; amount: number; currency: string; at: Date },
) {
  const day = utcDay(at);
  await tx.dailySales.upsert({
    where: { schoolId_courseId_day_currency: { schoolId, courseId, day, currency } },
    create: { schoolId, courseId, day, currency, sales: 1, revenue: amount },
    update: { sales: { increment: 1 }, revenue: { increment: amount } },
  });
}

/**
 * Takes a refunded order item back out of its course's sales for the day it was paid, so revenue counts only what was kept.
 *
 * @param tx Transaction scoped to the school.
 * @param sale The refunded sale.
 * @param sale.schoolId The school.
 * @param sale.courseId The course sold.
 * @param sale.amount Amount paid, in minor units.
 * @param sale.currency ISO code.
 * @param sale.at When it was paid.
 */
export async function reverseSale(
  tx: SchoolTransaction,
  { schoolId, courseId, amount, currency, at }: { schoolId: string; courseId: string; amount: number; currency: string; at: Date },
) {
  await tx.dailySales.updateMany({
    where: { schoolId, courseId, day: utcDay(at), currency },
    data: { sales: { decrement: 1 }, revenue: { decrement: amount } },
  });
}

/**
 * Counts one course completion for the day.
 *
 * @param tx Transaction scoped to the school.
 * @param completion The completion.
 * @param completion.schoolId The school.
 * @param completion.courseId The course completed.
 * @param completion.at When it was completed.
 */
export async function recordCompletion(tx: SchoolTransaction, { schoolId, courseId, at }: { schoolId: string; courseId: string; at: Date }) {
  const day = utcDay(at);
  await tx.dailyCompletions.upsert({
    where: { schoolId_courseId_day: { schoolId, courseId, day } },
    create: { schoolId, courseId, day, completions: 1 },
    update: { completions: { increment: 1 } },
  });
}
