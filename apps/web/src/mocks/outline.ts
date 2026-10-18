import { getMockCourse, type LessonType, type MockCourse } from "./courses";

// Mock outline store until WEB-12 connects the builder to API-03 (catalog).
// Lives in server memory, so saves survive a page reload but not a server restart.

/** A lesson as the course builder edits it. */
export type OutlineLesson = { id: string; title: string; type: LessonType; durationSec: number };

/** A section and its lessons, in order, as the course builder edits it. */
export type OutlineSection = { id: string; title: string; lessons: OutlineLesson[] };

/** A course's editable structure: sections and lessons in display order. */
export type Outline = { sections: OutlineSection[] };

/** Longest section or lesson title the builder accepts. */
export const TITLE_MAX_LENGTH = 200;

const SAVED = new Map<string, Outline>();

/**
 * Builds the store key; the school is part of it so one school never reads another's outline.
 *
 * @param schoolSlug - The school's slug.
 * @param courseSlug - The course's slug.
 * @returns The key for the saved outline.
 */
function keyOf(schoolSlug: string, courseSlug: string) {
  return `${schoolSlug}/${courseSlug}`;
}

/**
 * Converts a catalog course into an outline with ids, until real ids come from the API.
 *
 * @param course - The course to convert.
 * @returns Its sections and lessons with ids such as "s1" and "s1-l2".
 */
function toOutline(course: MockCourse): Outline {
  return {
    sections: course.sections.map((section, si) => ({
      id: `s${si + 1}`,
      title: section.title,
      lessons: section.lessons.map(({ title, type, durationSec }, li) => ({
        id: `s${si + 1}-l${li + 1}`,
        title,
        type,
        durationSec,
      })),
    })),
  };
}

/**
 * Loads a course's outline for the builder: the last save, or the catalog course when never saved.
 *
 * @param schoolSlug - The school's slug.
 * @param courseSlug - The course's slug.
 * @returns The outline, or `undefined` when the school has no course with that slug.
 */
export function getMockOutline(schoolSlug: string, courseSlug: string): Outline | undefined {
  const course = getMockCourse(schoolSlug, courseSlug);
  if (!course) return undefined;
  return SAVED.get(keyOf(schoolSlug, courseSlug)) ?? toOutline(course);
}

/**
 * Stores a course's outline, replacing the previous save.
 *
 * @param schoolSlug - The school's slug.
 * @param courseSlug - The course's slug.
 * @param outline - The outline to store.
 */
export function saveMockOutline(schoolSlug: string, courseSlug: string, outline: Outline) {
  SAVED.set(keyOf(schoolSlug, courseSlug), structuredClone(outline));
}
