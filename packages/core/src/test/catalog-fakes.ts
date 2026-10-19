// In-memory fake of the catalog port, for unit tests of the catalog service.
import type { CatalogStore, Course, CourseWithOutline, Outline } from "../catalog";

/**
 * Drops the outline from a stored course.
 *
 * @param course Stored course.
 * @param course.id Id.
 * @param course.title Title.
 * @param course.slug Slug.
 * @param course.description Description.
 * @param course.status Status.
 * @returns The course fields only.
 */
function withoutOutline({ id, title, slug, description, status }: CourseWithOutline): Course {
  return { id, title, slug, description, status };
}

/** In-memory `CatalogStore` for one school, whose courses tests can inspect. */
export class FakeCatalogStore implements CatalogStore {
  readonly courses: CourseWithOutline[] = [];

  /**
   * Lists courses, newest first.
   *
   * @returns The courses without outlines.
   */
  async listCourses() {
    return this.courses.toReversed().map(withoutOutline);
  }

  /**
   * Finds a course by slug.
   *
   * @param slug The slug.
   * @returns The course with its outline, or null.
   */
  async findCourseBySlug(slug: string) {
    return this.courses.find((course) => course.slug === slug) ?? null;
  }

  /**
   * Lists every course slug.
   *
   * @returns The slugs.
   */
  async listCourseSlugs() {
    return this.courses.map((course) => course.slug);
  }

  /**
   * Stores a draft course with a sequential id.
   *
   * @param input New course.
   * @param input.title Title.
   * @param input.slug Slug.
   * @returns The course.
   */
  async createCourse({ title, slug }: { title: string; slug: string }) {
    const course: Course = { id: `course-${this.courses.length + 1}`, title, slug, description: null, status: "draft" };
    this.courses.push({ ...course, sections: [] });
    return course;
  }

  /**
   * Applies changes to a course.
   *
   * @param id The course's id.
   * @param changes Fields to change.
   * @returns The updated course, or null when missing.
   */
  async updateCourse(id: string, changes: Partial<Pick<Course, "title" | "description" | "status">>) {
    const course = this.courses.find((candidate) => candidate.id === id);
    if (!course) return null;
    Object.assign(course, changes);
    return withoutOutline(course);
  }

  /**
   * Removes a course.
   *
   * @param id The course's id.
   * @returns Whether it existed.
   */
  async deleteCourse(id: string) {
    const index = this.courses.findIndex((course) => course.id === id);
    if (index !== -1) this.courses.splice(index, 1);
    return index !== -1;
  }

  /**
   * Replaces a course's outline.
   *
   * @param courseId The course's id.
   * @param outline The new outline.
   * @returns Whether the course existed.
   */
  async replaceOutline(courseId: string, outline: Outline) {
    const course = this.courses.find((candidate) => candidate.id === courseId);
    if (course) course.sections = structuredClone(outline.sections);
    return Boolean(course);
  }
}
