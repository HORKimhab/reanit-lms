export { InvalidStatsRangeError } from "./errors";
export type { CourseStats, Revenue, StatsStore } from "./ports";
export {
  DEFAULT_RANGE_DAYS,
  MAX_RANGE_DAYS,
  salesQuerySchema,
  type CompletionFunnel,
  type DailySale,
  type DayRange,
  type FunnelEntry,
  type SalesQuery,
  type SalesReport,
} from "./sales";
export { createAnalyticsService, type AnalyticsService } from "./service";
export { summarizeCourseStats, type StatsSummary } from "./summary";
