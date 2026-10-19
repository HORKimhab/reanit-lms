import type { Currency } from "../commerce";
import type { DailySale, DayRange, FunnelEntry } from "./sales";

/** Money in one currency; amounts in different currencies are never added together. */
export interface Revenue {
  currency: Currency;
  /** Integer minor units. */
  amount: number;
}

/** One course's totals, summed from the pre-aggregated daily stats. */
export interface CourseStats {
  courseId: string;
  title: string;
  slug: string;
  /** Students enrolled through a paid order. */
  students: number;
  /** Students who completed every lesson. */
  completions: number;
  /** One entry per currency it was sold in, sorted by currency code; empty when never sold. */
  revenue: Revenue[];
}

/**
 * One school's dashboard stats, read from the daily stats tables that payment confirmation and
 * course completion keep up to date. `@reanit/db` implements it with `createStatsStore`.
 */
export interface StatsStore {
  /** Every course of the school, with zeros for those without sales or completions. */
  listCourseStats(): Promise<CourseStats[]>;
  /** Daily sales per course and currency on the range's days. */
  listDailySales(range: DayRange): Promise<DailySale[]>;
  /** Orders paid on the range's days and since refunded, per currency, sorted by currency code. */
  listRefunds(range: DayRange): Promise<(Revenue & { orders: number })[]>;
  /** One entry per enrollment made on the range's days. */
  listFunnelEntries(range: DayRange): Promise<FunnelEntry[]>;
}
