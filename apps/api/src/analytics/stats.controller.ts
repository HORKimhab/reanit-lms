import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";

import { CurrentSchool, Roles, type StaffSchool } from "../schools/schools.decorators";
import { CourseStatsResponse, SalesQuery, SalesReportResponse } from "./analytics.dto";
import { ANALYTICS_FOR_SCHOOL, type AnalyticsForSchool } from "./analytics.tokens";

/** Length of `YYYY-MM-DD`, the start of an ISO date-time. */
const ISO_DAY_LENGTH = 10;

/**
 * Names the UTC day a report's midnight falls on.
 *
 * @param day Midnight UTC.
 * @returns `YYYY-MM-DD`.
 */
function isoDay(day: Date): string {
  return day.toISOString().slice(0, ISO_DAY_LENGTH);
}

/** Dashboard stats and the sales report for the caller's school. */
@Controller("stats")
@Roles("owner", "admin", "instructor")
export class StatsController {
  /**
   * Receives the factory for per-school stats services.
   *
   * @param analyticsFor Builds a stats service limited to one school.
   */
  constructor(@Inject(ANALYTICS_FOR_SCHOOL) private readonly analyticsFor: AnalyticsForSchool) {}

  /**
   * Lists every course with its students, completions and revenue.
   *
   * @param school The caller's school.
   * @returns The courses, best sellers first.
   */
  @Get("courses")
  @ApiOkResponse({ type: CourseStatsResponse })
  async courses(@CurrentSchool() school: StaffSchool): Promise<CourseStatsResponse> {
    return { courses: await this.analyticsFor(school.id).getCourseStats() };
  }

  /**
   * Reports sales over a range of UTC days: per day with zeros, per course, totals, refunds and the
   * completion funnel of the range's new students.
   *
   * @param school The caller's school.
   * @param query The first and last day; the last 30 days up to today when left out.
   * @returns The report, with days as `YYYY-MM-DD`.
   * @throws {InvalidStatsRangeError} When the range ends before it starts or covers more than a year (400).
   */
  @Get("sales")
  @ApiOkResponse({ type: SalesReportResponse })
  async sales(@CurrentSchool() school: StaffSchool, @Query() query: SalesQuery): Promise<SalesReportResponse> {
    const report = await this.analyticsFor(school.id).getSalesReport(query);
    return {
      ...report,
      range: { from: isoDay(report.range.from), to: isoDay(report.range.to) },
      daily: report.daily.map((day) => ({ ...day, day: isoDay(day.day) })),
    };
  }
}
