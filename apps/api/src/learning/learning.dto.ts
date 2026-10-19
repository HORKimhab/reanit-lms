import { progressSchema } from "@reanit/core/learning";
import { subdomainSchema } from "@reanit/core/schools";
import { z } from "zod";

import { courseWithOutlineSchema } from "../catalog/catalog.dto";
import { createZodDto } from "../http/zod-dto";

/** Path of a course in a school's player. */
export class PlayerCourseParams extends createZodDto(z.object({ subdomain: subdomainSchema, slug: z.string().min(1).max(80) })) {}

/** Path of a lesson in a school's player. */
export class PlayerLessonParams extends createZodDto(z.object({ subdomain: subdomainSchema, lessonId: z.uuid() })) {}

/** `PUT .../lessons/:lessonId/progress` body: a heartbeat's video position, completion, or both. */
export class ProgressBody extends createZodDto(progressSchema) {}

/** A course as its enrolled student plays it: the outline and their progress per lesson opened. */
export class PlayerCourseResponse extends createZodDto(
  z.object({
    course: courseWithOutlineSchema.extend({
      progress: z.array(z.object({ lessonId: z.uuid(), positionSeconds: z.number().int(), isCompleted: z.boolean() })),
    }),
  }),
) {}
