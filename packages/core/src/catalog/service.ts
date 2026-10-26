import type { PlanGuard } from "../schools/plans";
import { CourseNotFoundError } from "./errors";
import type { CatalogStore, Course, CourseWithOutline } from "./ports";
import { uniqueCourseSlug, type CreateCourseInput, type Outline, type UpdateCourseInput } from "./rules";

/**
 * Tells whether students can see a course.
 *
 * @param course The course.
 * @returns True when it is published.
 */
function isPublished(course: Course): boolean {
  return course.status === "published";
}

/**
 * Builds one school's catalog use cases over a store scoped to that school.
 *
 * @param dependencies Store for the school's catalog, and its plan.
 * @param dependencies.store The school's courses, sections and lessons.
 * @param dependencies.plan The school's plan, which limits how many courses are published at once.
 * @returns Course and outline operations.
 * @example
 * const catalog = createCatalogService({ store: createCatalogStore(db, school.id), plan: createPlanGuard({ store: createSchoolPlanStore(db, school.id), clock }) });
 */
export function createCatalogService({ store, plan }: { store: CatalogStore; plan: Pick<PlanGuard, "assertWithin"> }) {
  return {
    /**
     * Lists the school's courses, newest first.
     *
     * @returns The courses without outlines.
     */
    listCourses(): Promise<Course[]> {
      return store.listCourses();
    },

    /**
     * Loads a course with its outline.
     *
     * @param slug The course's slug.
     * @returns The course.
     * @throws {CourseNotFoundError} When the school has no course with that slug.
     */
    async getCourse(slug: string): Promise<CourseWithOutline> {
      const course = await store.findCourseBySlug(slug);
      if (!course) throw new CourseNotFoundError();
      return course;
    },

    /**
     * Lists the courses students can see, newest first.
     *
     * @returns The published courses without outlines.
     */
    async listPublishedCourses(): Promise<Course[]> {
      return (await store.listCourses()).filter(isPublished);
    },

    /**
     * Loads a course for its public sales page. Drafts look like missing courses.
     *
     * @param slug The course's slug.
     * @returns The published course with its outline.
     * @throws {CourseNotFoundError} When the school has no published course with that slug.
     */
    async getPublishedCourse(slug: string): Promise<CourseWithOutline> {
      const course = await store.findCourseBySlug(slug);
      if (!course || !isPublished(course)) throw new CourseNotFoundError();
      return course;
    },

    /**
     * Creates a draft course with a slug made from its title.
     *
     * @param input Parsed new-course form.
     * @returns The new course.
     */
    async createCourse(input: CreateCourseInput): Promise<Course> {
      const slug = uniqueCourseSlug(input.title, await store.listCourseSlugs());
      return store.createCourse({ title: input.title, slug });
    },

    /**
     * Changes a course's title, description or status. The slug stays, so links keep working.
     *
     * @param id The course's id.
     * @param changes Parsed course-details form.
     * @returns The updated course.
     * @throws {PlanLimitError} When publishing would pass the plan's number of published courses.
     * @throws {CourseNotFoundError} When the school has no course with that id.
     */
    async updateCourse(id: string, changes: UpdateCourseInput): Promise<Course> {
      if (changes.status === "published") await plan.assertWithin("publishedCourses", await store.countPublishedCourses(id));
      const course = await store.updateCourse(id, changes);
      if (!course) throw new CourseNotFoundError();
      return course;
    },

    /**
     * Deletes a course with its sections and lessons.
     *
     * @param id The course's id.
     * @throws {CourseNotFoundError} When the school has no course with that id.
     */
    async deleteCourse(id: string): Promise<void> {
      if (!(await store.deleteCourse(id))) throw new CourseNotFoundError();
    },

    /**
     * Saves the builder's outline: sections and lessons are created, updated, reordered
     * and removed to match it, all at once.
     *
     * @param courseId The course's id.
     * @param outline Parsed outline.
     * @throws {CourseNotFoundError} When the school has no course with that id.
     */
    async saveOutline(courseId: string, outline: Outline): Promise<void> {
      if (!(await store.replaceOutline(courseId, outline))) throw new CourseNotFoundError();
    },
  };
}

/** One school's catalog use cases. */
export type CatalogService = ReturnType<typeof createCatalogService>;
