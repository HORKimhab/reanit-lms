import { courseStats, getMockCourse, type MockCourse } from "./courses";
import { MOCK_SCHOOL_SLUG } from "./schools";

// Mock enrollments for MOCK_USER until API-06 (learning) lands.
const ENROLLMENTS = [
  { schoolSlug: MOCK_SCHOOL_SLUG, courseSlug: "brand-design-basics", completedLessons: 4 },
  { schoolSlug: MOCK_SCHOOL_SLUG, courseSlug: "social-media-content", completedLessons: 4 },
];

export type MockEnrollment = { course: MockCourse; completedLessons: number; totalLessons: number; percent: number };

export function getMockEnrollments(schoolSlug: string): MockEnrollment[] {
  return ENROLLMENTS.filter((e) => e.schoolSlug === schoolSlug).flatMap((e) => {
    const course = getMockCourse(e.schoolSlug, e.courseSlug);
    if (!course) return [];
    const totalLessons = courseStats(course).lessons;
    return [{ course, completedLessons: e.completedLessons, totalLessons, percent: (e.completedLessons / totalLessons) * 100 }];
  });
}
