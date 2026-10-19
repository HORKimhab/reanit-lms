import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";

import type { RequestContext } from "../context/request-context";
import { CurrentSchool, Roles } from "../schools/schools.decorators";
import { CourseStatsResponse } from "./analytics.dto";
import { ANALYTICS_FOR_SCHOOL, type AnalyticsForSchool } from "./analytics.tokens";

/** The staff school `@Roles` resolved for the request. */
type StaffSchool = NonNullable<RequestContext["school"]>;

/** Dashboard stats for the caller's school, read from the pre-aggregated daily tables. */
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
}
