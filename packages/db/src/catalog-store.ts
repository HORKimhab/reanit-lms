import type { DbClient } from "./client";
import type { LessonType } from "./generated/prisma/client";
import { forSchool, inSchoolTransaction, type SchoolTransaction } from "./tenant";

const COURSE_FIELDS = { id: true, title: true, slug: true, description: true, status: true } as const;
const NEWEST_FIRST = { createdAt: "desc" } as const;
const IN_ORDER = { position: "asc" } as const;

/** Outline shape the store reads and writes; matches `Outline` in `@reanit/core/catalog`. */
type OutlineInput = {
  sections: {
    id: string;
    title: string;
    lessons: { id: string; title: string; type: LessonType; durationSeconds: number }[];
  }[];
};

/**
 * Creates or updates each section and lesson to match the outline, in order. Ids already in
 * this course are updated; new ids are inserted (an id owned elsewhere fails the insert).
 *
 * @param tx Transaction scoped to the school.
 * @param schoolId The school's id.
 * @param courseId The course's id.
 * @param outline The outline to write.
 */
async function upsertOutline(tx: SchoolTransaction, schoolId: string, courseId: string, outline: OutlineInput) {
  const sectionIds = new Set((await tx.section.findMany({ where: { courseId }, select: { id: true } })).map(({ id }) => id));
  const lessonIds = new Set(
    (await tx.lesson.findMany({ where: { section: { courseId } }, select: { id: true } })).map(({ id }) => id),
  );

  for (const [sectionPosition, { id, title, lessons }] of outline.sections.entries()) {
    const section = { title, position: sectionPosition };
    if (sectionIds.has(id)) await tx.section.update({ where: { id }, data: section });
    else await tx.section.create({ data: { id, schoolId, courseId, ...section } });

    for (const [lessonPosition, { id: lessonId, ...fields }] of lessons.entries()) {
      const lesson = { ...fields, sectionId: id, position: lessonPosition };
      if (lessonIds.has(lessonId)) await tx.lesson.update({ where: { id: lessonId }, data: lesson });
      else await tx.lesson.create({ data: { id: lessonId, schoolId, ...lesson } });
    }
  }
}

/**
 * One school's catalog: courses with their sections and lessons. Every query goes through the
 * tenant client, so another school's rows are invisible; it satisfies `CatalogStore` from `@reanit/core/catalog`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school whose catalog this is.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const catalog = createCatalogService({ store: createCatalogStore(db, school.id) });
 */
export function createCatalogStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Lists the school's courses, newest first.
     *
     * @returns The courses without outlines.
     */
    listCourses() {
      return tenant.course.findMany({ select: COURSE_FIELDS, orderBy: NEWEST_FIRST });
    },

    /**
     * Loads a course with its sections and lessons in order.
     *
     * @param slug The course's slug.
     * @returns The course, or null when the school has none with that slug.
     */
    findCourseBySlug(slug: string) {
      return tenant.course.findUnique({
        where: { schoolId_slug: { schoolId, slug } },
        select: {
          ...COURSE_FIELDS,
          sections: {
            orderBy: IN_ORDER,
            select: {
              id: true,
              title: true,
              lessons: { orderBy: IN_ORDER, select: { id: true, title: true, type: true, durationSeconds: true } },
            },
          },
        },
      });
    },

    /**
     * Lists every slug in use, for picking a free one.
     *
     * @returns The slugs.
     */
    async listCourseSlugs() {
      return (await tenant.course.findMany({ select: { slug: true } })).map(({ slug }) => slug);
    },

    /**
     * Creates a draft course.
     *
     * @param course New course.
     * @param course.title Title.
     * @param course.slug Free slug.
     * @returns The course.
     * @throws {Error} When the slug is taken (unique constraint).
     */
    createCourse(course: { title: string; slug: string }) {
      return tenant.course.create({ data: { ...course, schoolId }, select: COURSE_FIELDS });
    },

    /**
     * Changes a course's details.
     *
     * @param id The course's id.
     * @param changes Fields to change.
     * @param changes.title New title.
     * @param changes.description New description.
     * @param changes.status New status.
     * @returns The updated course, or null when the school has no such course.
     */
    async updateCourse(
      id: string,
      changes: { title?: string; description?: string | null; status?: "draft" | "published" },
    ) {
      const { count } = await tenant.course.updateMany({ where: { id }, data: changes });
      return count ? tenant.course.findUnique({ where: { id }, select: COURSE_FIELDS }) : null;
    },

    /**
     * Deletes a course; its sections and lessons go with it.
     *
     * @param id The course's id.
     * @returns Whether the school had such a course.
     */
    async deleteCourse(id: string) {
      return (await tenant.course.deleteMany({ where: { id } })).count > 0;
    },

    /**
     * Makes the course's sections and lessons match the outline, atomically. Upserts run
     * before deletes, so a lesson moved out of a removed section survives.
     *
     * @param courseId The course's id.
     * @param outline Sections and lessons in display order.
     * @returns False when the school has no such course.
     * @throws {Error} When an id belongs to a row outside this course; nothing is saved.
     */
    replaceOutline(courseId: string, outline: OutlineInput) {
      return inSchoolTransaction(db, schoolId, async (tx) => {
        if (!(await tx.course.findUnique({ where: { id: courseId }, select: { id: true } }))) return false;
        await upsertOutline(tx, schoolId, courseId, outline);

        const keptSections = outline.sections.map(({ id }) => id);
        const keptLessons = outline.sections.flatMap(({ lessons }) => lessons.map(({ id }) => id));
        await tx.lesson.deleteMany({ where: { section: { courseId }, id: { notIn: keptLessons } } });
        await tx.section.deleteMany({ where: { courseId, id: { notIn: keptSections } } });
        return true;
      });
    },
  };
}
