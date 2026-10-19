import type { AnalyticsService } from "@reanit/core/analytics";

/** Injection token for `AnalyticsForSchool`. */
export const ANALYTICS_FOR_SCHOOL = Symbol("ANALYTICS_FOR_SCHOOL");

/** Builds one school's dashboard stats service on the tenant client. */
export type AnalyticsForSchool = (schoolId: string) => AnalyticsService;
