import type { SalesQuery, SalesReport } from "@reanit/core/analytics";

import { getApi } from "../api";
import { checkStaffResponse } from "../schools/staff";

/**
 * Reads a `YYYY-MM-DD` day as midnight UTC.
 *
 * @param day The day.
 * @returns The moment.
 */
function utcDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/**
 * Loads the signed-in creator's school's sales report for a range of UTC days.
 *
 * @param query The first and last day; the API reports the last 30 days when left out.
 * @returns The report with its days as Dates, or null when the API refuses the range.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function getSalesReport(query: SalesQuery): Promise<SalesReport | null> {
  const { data, response } = await (await getApi()).GET("/stats/sales", { params: { query } });
  if (response.status === 400) return null;
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the report.
  const report = data!;
  return {
    ...report,
    range: { from: utcDay(report.range.from), to: utcDay(report.range.to) },
    daily: report.daily.map((day) => ({ ...day, day: utcDay(day.day) })),
  };
}
