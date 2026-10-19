// In-memory fake of the analytics port, for unit tests of the stats and sales report use cases.
import type { CourseStats, DailySale, DayRange, FunnelEntry, Revenue, StatsStore } from "../analytics";

/** `StatsStore` that answers with the rows tests give it and records the ranges it was asked for. */
export class FakeStatsStore implements StatsStore {
  courses: CourseStats[] = [];
  dailySales: DailySale[] = [];
  refunds: (Revenue & { orders: number })[] = [];
  funnel: FunnelEntry[] = [];
  /** Every range a query was made for. */
  readonly ranges: DayRange[] = [];

  /**
   * Lists the given course stats.
   *
   * @returns `courses`.
   */
  async listCourseStats() {
    return this.courses;
  }

  /**
   * Lists the given daily sales that fall in the range.
   *
   * @param range The days asked for.
   * @returns The rows on those days.
   */
  async listDailySales(range: DayRange) {
    this.ranges.push(range);
    return this.dailySales.filter(({ day }) => day >= range.from && day <= range.to);
  }

  /**
   * Lists the given refunds.
   *
   * @param range The days asked for.
   * @returns `refunds`.
   */
  async listRefunds(range: DayRange) {
    this.ranges.push(range);
    return this.refunds;
  }

  /**
   * Lists the given funnel entries.
   *
   * @param range The days asked for.
   * @returns `funnel`.
   */
  async listFunnelEntries(range: DayRange) {
    this.ranges.push(range);
    return this.funnel;
  }
}
