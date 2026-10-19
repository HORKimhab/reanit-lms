import { flattenLessons, getMockCourse, type MockCourse } from "./courses";
import { MOCK_SCHOOL_SLUG } from "./schools";

// Mock enrollments for MOCK_USER on "My courses" until it is connected to the learning API (the player already is).
const ENROLLMENTS = [
  { schoolSlug: MOCK_SCHOOL_SLUG, courseSlug: "brand-design-basics", completedLessons: 4 },
  { schoolSlug: MOCK_SCHOOL_SLUG, courseSlug: "social-media-content", completedLessons: 4 },
];

const PERCENT = 100;

/** The signed-in student's progress in one course. */
export type MockEnrollment = {
  course: MockCourse;
  /** Lessons finished so far, counted from the start of the course. */
  completedLessons: number;
  totalLessons: number;
  /** 0 to 100. */
  percent: number;
  isCompleted: boolean;
};

/**
 * Lists the signed-in student's enrollments in a school, with progress.
 *
 * @param schoolSlug - The school's slug.
 * @returns The enrollments, empty when there are none. Never another school's.
 */
export function getMockEnrollments(schoolSlug: string): MockEnrollment[] {
  return ENROLLMENTS.filter((e) => e.schoolSlug === schoolSlug).flatMap((e) => {
    const course = getMockCourse(e.schoolSlug, e.courseSlug);
    if (!course) return [];
    return [toEnrollment(course, e.completedLessons)];
  });
}

/**
 * Builds an enrollment's progress figures from its completed-lesson count.
 *
 * @param course - The enrolled course.
 * @param completedLessons - Lessons finished so far.
 * @returns The enrollment with totals, percent and completion flag.
 */
export function toEnrollment(course: MockCourse, completedLessons: number): MockEnrollment {
  const totalLessons = flattenLessons(course).length;
  return {
    course,
    completedLessons,
    totalLessons,
    percent: totalLessons === 0 ? 0 : (completedLessons / totalLessons) * PERCENT,
    isCompleted: completedLessons >= totalLessons,
  };
}
