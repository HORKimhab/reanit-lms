import type { COURSE_STATUSES, LESSON_TYPES, Outline } from "./rules";

/** Kind of content a lesson holds. */
export type LessonType = (typeof LESSON_TYPES)[number];
/** Whether students can see a course. */
export type CourseStatus = (typeof COURSE_STATUSES)[number];

/** A course without its outline. */
export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: CourseStatus;
}

/** A course with its sections and lessons in display order. */
export type CourseWithOutline = Course & Outline;

/**
 * One school's catalog. `@reanit/db` implements it with `createCatalogStore`,
 * already scoped to the school, so no method takes a school id.
 */
export interface CatalogStore {
  listCourses(): Promise<Course[]>;
  findCourseBySlug(slug: string): Promise<CourseWithOutline | null>;
  listCourseSlugs(): Promise<string[]>;
  createCourse(course: { title: string; slug: string }): Promise<Course>;
  /** Returns null when the school has no such course. */
  updateCourse(id: string, changes: Partial<Pick<Course, "title" | "description" | "status">>): Promise<Course | null>;
  /** Returns whether a course was deleted. */
  deleteCourse(id: string): Promise<boolean>;
  /** Replaces the course's sections and lessons; returns false when the school has no such course. */
  replaceOutline(courseId: string, outline: Outline): Promise<boolean>;
}
