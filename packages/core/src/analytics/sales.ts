import { z } from "zod";

import type { Currency } from "../commerce";
import { InvalidStatsRangeError } from "./errors";
import type { Revenue } from "./ports";
import { sumByCurrency } from "./summary";

/** Days a sales report covers when no range is asked for, today included. */
export const DEFAULT_RANGE_DAYS = 30;
/** Longest range a sales report covers: a year, leap day included. */
export const MAX_RANGE_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Share of a course's lessons a student has completed to count as halfway. */
const HALFWAY = 0.5;

/** A UTC day, `YYYY-MM-DD`, as reports name days. */
const daySchema = z.iso.date();

/** Sales report query: the first and last UTC day, both optional. */
export const salesQuerySchema = z.object({ from: daySchema.optional(), to: daySchema.optional() });

/** Parsed sales report query. */
export type SalesQuery = z.infer<typeof salesQuerySchema>;

/** The UTC days a report covers, both included. */
export interface DayRange {
  /** Midnight UTC of the first day. */
  from: Date;
  /** Midnight UTC of the last day. */
  to: Date;
}

/** One course's sales in one currency on one UTC day, as the daily sales table holds them. */
export interface DailySale {
  day: Date;
  course: { id: string; title: string; slug: string };
  currency: Currency;
  /** Paid orders. */
  sales: number;
  /** Integer minor units. */
  revenue: number;
}

/** One enrollment's way through its course, for the completion funnel. */
export interface FunnelEntry {
  /** Whether the student opened any lesson. */
  isStarted: boolean;
  completedLessons: number;
  totalLessons: number;
  isCompleted: boolean;
}

/** How far the students who enrolled in a range got. */
export interface CompletionFunnel {
  enrolled: number;
  started: number;
  /** Completed at least half of their course's lessons. */
  halfway: number;
  completed: number;
}

/** A school's sales over a range of days. */
export interface SalesReport {
  range: DayRange;
  /** Every day of the range, oldest first, with zeros on days without sales. */
  daily: { day: Date; sales: number; revenue: Revenue[] }[];
  /** Each course that sold in the range, best-selling first. */
  byCourse: { courseId: string; title: string; slug: string; sales: number; revenue: Revenue[] }[];
  totals: { sales: number; revenue: Revenue[] };
  /** Paid orders of the range later refunded, per currency. */
  refunds: (Revenue & { orders: number })[];
  funnel: CompletionFunnel;
}

/**
 * Gives midnight UTC of the day a moment falls on.
 *
 * @param moment The moment.
 * @returns The day's start.
 */
function utcDay(moment: Date): Date {
  return new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate()));
}

/**
 * Works out the days a report covers: the days asked for, or the last 30 days up to today.
 *
 * @param query The first and last day, if given.
 * @param now The current time, for today.
 * @returns The range, both days included.
 * @throws {InvalidStatsRangeError} When the range ends before it starts or covers more than `MAX_RANGE_DAYS`.
 * @example
 * resolveRange({}, new Date("2026-10-20T15:00:00Z")); // 2026-09-21 to 2026-10-20
 */
export function resolveRange(query: SalesQuery, now: Date): DayRange {
  const to = query.to ? new Date(query.to) : utcDay(now);
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);
  const days = (to.getTime() - from.getTime()) / DAY_MS + 1;
  if (days < 1 || days > MAX_RANGE_DAYS) throw new InvalidStatsRangeError();
  return { from, to };
}

/**
 * Lays daily sales out over every day of a range, with zeros on days without sales in each currency sold.
 *
 * @param rows The range's daily sales, per course and currency.
 * @param range The days to cover.
 * @returns One entry per day, oldest first.
 */
function dailyTotals(rows: readonly DailySale[], range: DayRange): SalesReport["daily"] {
  const currencies = [...new Set(rows.map((row) => row.currency))].toSorted();
  const days: SalesReport["daily"] = [];
  for (let time = range.from.getTime(); time <= range.to.getTime(); time += DAY_MS) {
    const sold = rows.filter((row) => row.day.getTime() === time);
    const revenue = sumByCurrency([...currencies.map((currency) => ({ currency, amount: 0 })), ...sold.map(({ currency, revenue: amount }) => ({ currency, amount }))]);
    days.push({ day: new Date(time), sales: sold.reduce((total, row) => total + row.sales, 0), revenue });
  }
  return days;
}

/**
 * Adds daily sales up per course.
 *
 * @param rows The range's daily sales.
 * @returns Each course that sold, best-selling first, then by title.
 */
function courseTotals(rows: readonly DailySale[]): SalesReport["byCourse"] {
  const courses = new Map<string, { course: DailySale["course"]; sales: number; amounts: Revenue[] }>();
  for (const { course, currency, sales, revenue } of rows) {
    const total = courses.get(course.id) ?? { course, sales: 0, amounts: [] };
    courses.set(course.id, { course, sales: total.sales + sales, amounts: [...total.amounts, { currency, amount: revenue }] });
  }
  return [...courses.values()]
    .map(({ course, sales, amounts }) => ({ courseId: course.id, title: course.title, slug: course.slug, sales, revenue: sumByCurrency(amounts) }))
    .toSorted((a, b) => b.sales - a.sales || a.title.localeCompare(b.title));
}

/**
 * Counts how far enrollments got through their courses.
 *
 * @param entries One entry per enrollment.
 * @returns The funnel's counts, each at most the one before.
 * @example
 * completionFunnel([{ isStarted: true, completedLessons: 2, totalLessons: 4, isCompleted: false }]); // { enrolled: 1, started: 1, halfway: 1, completed: 0 }
 */
export function completionFunnel(entries: readonly FunnelEntry[]): CompletionFunnel {
  return {
    enrolled: entries.length,
    started: entries.filter((entry) => entry.isStarted).length,
    halfway: entries.filter((entry) => entry.isCompleted || (entry.totalLessons > 0 && entry.completedLessons / entry.totalLessons >= HALFWAY)).length,
    completed: entries.filter((entry) => entry.isCompleted).length,
  };
}

/**
 * Builds a sales report from the range's daily sales, refunds and enrollments.
 *
 * @param data What the report is made of.
 * @param data.range The days covered.
 * @param data.rows Daily sales per course and currency in the range.
 * @param data.refunds Refunded orders per currency.
 * @param data.funnel One entry per enrollment made in the range.
 * @returns The report.
 * @example
 * buildSalesReport({ range, rows, refunds: [], funnel: [] }).totals; // { sales: 3, revenue: [{ currency: "USD", amount: 14700 }] }
 */
export function buildSalesReport({
  range,
  rows,
  refunds,
  funnel,
}: {
  range: DayRange;
  rows: readonly DailySale[];
  refunds: SalesReport["refunds"];
  funnel: readonly FunnelEntry[];
}): SalesReport {
  return {
    range,
    daily: dailyTotals(rows, range),
    byCourse: courseTotals(rows),
    totals: { sales: rows.reduce((total, row) => total + row.sales, 0), revenue: sumByCurrency(rows.map(({ currency, revenue }) => ({ currency, amount: revenue }))) },
    refunds,
    funnel: completionFunnel(funnel),
  };
}
