import { CURRENCIES } from "@reanit/core/commerce";
import { z } from "zod";

import { createZodDto } from "../http/zod-dto";

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
        revenue: z.array(z.object({ currency: z.enum(CURRENCIES), amount: z.number().int() })),
      }),
    ),
  }),
) {}
