import { flattenLessons, getMockCourse, type FlatLesson, type MockCourse } from "./courses";
import { MOCK_SCHOOL_SLUG } from "./schools";

// Mock enrollments for MOCK_USER until API-06 (learning) lands.
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

/**
 * Looks up the signed-in student's enrollment in one course.
 *
 * @param schoolSlug - The school's slug.
 * @param courseSlug - The course's slug.
 * @returns The enrollment, or `undefined` when the student is not enrolled.
 */
export function getMockEnrollment(schoolSlug: string, courseSlug: string) {
  return getMockEnrollments(schoolSlug).find((e) => e.course.slug === courseSlug);
}

/**
 * Picks where the player resumes: the first unfinished lesson, or the last one when all are done.
 *
 * @param enrollment - The student's enrollment.
 * @returns The lesson to open, or `undefined` when the course has no lessons.
 */
export function getResumeLesson(enrollment: MockEnrollment): FlatLesson | undefined {
  const lessons = flattenLessons(enrollment.course);
  return lessons[Math.min(enrollment.completedLessons, lessons.length - 1)];
}
