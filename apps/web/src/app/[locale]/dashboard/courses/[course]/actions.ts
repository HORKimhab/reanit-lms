"use server";

import { z } from "zod";

import { getMockCourse, LESSON_TYPES } from "@/mocks/courses";
import { saveMockOutline, TITLE_MAX_LENGTH } from "@/mocks/outline";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";

const TitleSchema = z.string().max(TITLE_MAX_LENGTH);
const IdSchema = z.string().min(1);

const OutlineSchema = z.object({
  sections: z.array(
    z.object({
      id: IdSchema,
      title: TitleSchema,
      lessons: z.array(
        z.object({
          id: IdSchema,
          title: TitleSchema,
          type: z.enum(LESSON_TYPES),
          durationSec: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
});

/**
 * Autosave target for the course builder. Stores in the mock store until WEB-12 calls the catalog API.
 *
 * @param courseSlug - The course being edited.
 * @param outline - The outline from the browser; untrusted until parsed.
 * @throws {z.ZodError} When the outline does not match the outline schema.
 * @throws {Error} When the school has no course with that slug.
 */
export async function saveCourseOutline(courseSlug: string, outline: unknown) {
  const parsed = OutlineSchema.parse(outline);
  if (!getMockCourse(MOCK_SCHOOL_SLUG, courseSlug)) throw new Error(`Unknown course: ${courseSlug}`);
  saveMockOutline(MOCK_SCHOOL_SLUG, courseSlug, parsed);
}
