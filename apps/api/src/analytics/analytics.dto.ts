import { salesQuerySchema } from "@reanit/core/analytics";
import { CURRENCIES } from "@reanit/core/commerce";
import { z } from "zod";

import { createZodDto } from "../http/zod-dto";

const revenueSchema = z.array(z.object({ currency: z.enum(CURRENCIES), amount: z.number().int() }));

/** Every course of the school with its students, completions and revenue per currency, best sellers first. */
export class CourseStatsResponse extends createZodDto(
  z.object({
    courses: z.array(
      z.object({
        courseId: z.uuid(),
        title: z.string(),
        slug: z.string(),
        students: z.number().int(),
        completions: z.number().int(),
        revenue: revenueSchema,
      }),
    ),
  }),
) {}

/** Sales report query: the first and last UTC day (`YYYY-MM-DD`); the last 30 days up to today when left out. */
export class SalesQuery extends createZodDto(salesQuerySchema) {}

/** A school's sales over a range of UTC days: per day (zeros included), per course, totals, refunds and the completion funnel. */
export class SalesReportResponse extends createZodDto(
  z.object({
    range: z.object({ from: z.iso.date(), to: z.iso.date() }),
    daily: z.array(z.object({ day: z.iso.date(), sales: z.number().int(), revenue: revenueSchema })),
    byCourse: z.array(z.object({ courseId: z.uuid(), title: z.string(), slug: z.string(), sales: z.number().int(), revenue: revenueSchema })),
    totals: z.object({ sales: z.number().int(), revenue: revenueSchema }),
    refunds: z.array(z.object({ currency: z.enum(CURRENCIES), amount: z.number().int(), orders: z.number().int() })),
    funnel: z.object({ enrolled: z.number().int(), started: z.number().int(), halfway: z.number().int(), completed: z.number().int() }),
  }),
) {}
