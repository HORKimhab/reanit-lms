import { z } from "zod";

import { uniqueSlug } from "../shared/slug";

/** Longest course, section or lesson title. */
export const TITLE_MAX_LENGTH = 200;
/** Longest course description. */
export const DESCRIPTION_MAX_LENGTH = 5000;
/** Slug for a title with no Latin letters or digits. */
const FALLBACK_SLUG = "course";

/** Every kind of content a lesson can hold. */
export const LESSON_TYPES = ["video", "text", "pdf"] as const;

/** Whether students can see a course. */
export const COURSE_STATUSES = ["draft", "published"] as const;

const titleSchema = z.string().trim().min(1).max(TITLE_MAX_LENGTH);
/** Builder titles may be blank while being typed; the builder shows a placeholder. */
const outlineTitleSchema = z.string().max(TITLE_MAX_LENGTH);

/** New-course form input. */
export const createCourseSchema = z.object({ title: titleSchema });

/** Course details form input; omitted fields stay as they are. */
export const updateCourseSchema = z
  .object({
    title: titleSchema,
    description: z.string().trim().max(DESCRIPTION_MAX_LENGTH),
    status: z.enum(COURSE_STATUSES),
  })
  .partial();

/** A course's sections and lessons in display order, as the builder saves it. Ids are made by the client. */
export const outlineSchema = z
  .object({
    sections: z.array(
      z.object({
        id: z.uuid(),
        title: outlineTitleSchema,
        lessons: z.array(
          z.object({
            id: z.uuid(),
            title: outlineTitleSchema,
            type: z.enum(LESSON_TYPES),
            durationSeconds: z.number().int().nonnegative(),
          }),
        ),
      }),
    ),
  })
  .refine(
    ({ sections }) => {
      const ids = sections.flatMap((section) => [section.id, ...section.lessons.map((lesson) => lesson.id)]);
      return new Set(ids).size === ids.length;
    },
    { message: "Outline ids must be unique" },
  );

/** Parsed new-course input. */
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
/** Parsed course-details input. */
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
/** Parsed outline. */
export type Outline = z.infer<typeof outlineSchema>;

/**
 * Picks a URL slug for a new course that no other course in the school uses,
 * numbering it (`intro-2`, `intro-3`, …) when the plain slug is taken.
 *
 * @param title The course title.
 * @param takenSlugs Slugs the school's courses already use.
 * @returns A free slug.
 * @example
 * uniqueCourseSlug("Intro to Design", ["intro-to-design"]); // "intro-to-design-2"
 */
export function uniqueCourseSlug(title: string, takenSlugs: Iterable<string>): string {
  return uniqueSlug(title, takenSlugs, FALLBACK_SLUG);
}

/**
 * Counts a course's lessons and adds up their running time, for catalog cards and sales pages.
 *
 * @param outline The course's sections and lessons.
 * @param outline.sections The sections in order.
 * @returns The number of lessons and their total length in seconds.
 * @example
 * outlineStats(course); // { lessons: 12, durationSeconds: 5400 }
 */
export function outlineStats({ sections }: Pick<Outline, "sections">): { lessons: number; durationSeconds: number } {
  const lessons = sections.flatMap((section) => section.lessons);
  return { lessons: lessons.length, durationSeconds: lessons.reduce((total, lesson) => total + lesson.durationSeconds, 0) };
}
