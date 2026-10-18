import { getMockCourse } from "./courses";
import { toEnrollment } from "./enrollments";
import { MOCK_SCHOOL_SLUG } from "./schools";

// Mock students until API-08 (students + school settings) lands.
const STUDENTS = [
  {
    schoolSlug: MOCK_SCHOOL_SLUG,
    id: "st-1",
    name: "Sokha Chan",
    email: "sokha@example.com",
    joinedOn: "2026-03-14",
    enrollments: [
      { courseSlug: "brand-design-basics", completedLessons: 4 },
      { courseSlug: "social-media-content", completedLessons: 4 },
    ],
  },
  {
    schoolSlug: MOCK_SCHOOL_SLUG,
    id: "st-2",
    name: "Vanna Lim",
    email: "vanna@example.com",
    joinedOn: "2026-08-02",
    enrollments: [{ courseSlug: "brand-design-basics", completedLessons: 9 }],
  },
  {
    schoolSlug: MOCK_SCHOOL_SLUG,
    id: "st-3",
    name: "Dara Pich",
    email: "dara.pich@example.com",
    joinedOn: "2026-09-21",
    enrollments: [{ courseSlug: "social-media-content", completedLessons: 1 }],
  },
  // Another school's student: never listed in the mock school's dashboard.
  {
    schoolSlug: "other-school",
    id: "st-9",
    name: "Other Student",
    email: "other@example.com",
    joinedOn: "2026-10-01",
    enrollments: [],
  },
];

/** A student as the dashboard's students list shows them. */
export type StudentSummary = {
  id: string;
  name: string;
  email: string;
  /** Calendar date of the first enrollment, `YYYY-MM-DD`. */
  joinedOn: string;
  /** Courses the student is enrolled in. */
  courses: number;
  /** Of those, courses with every lesson done. */
  completedCourses: number;
};

/**
 * Lists a school's students with their enrollment counts, newest first.
 *
 * @param schoolSlug - The school's slug.
 * @returns The students, empty when the school has none. Never another school's.
 */
export function getMockStudents(schoolSlug: string): StudentSummary[] {
  return STUDENTS.filter((s) => s.schoolSlug === schoolSlug)
    .map(({ id, name, email, joinedOn, enrollments }) => {
      const progress = enrollments.flatMap(({ courseSlug, completedLessons }) => {
        const course = getMockCourse(schoolSlug, courseSlug);
        return course ? [toEnrollment(course, completedLessons)] : [];
      });
      return {
        id,
        name,
        email,
        joinedOn,
        courses: progress.length,
        completedCourses: progress.filter((e) => e.isCompleted).length,
      };
    })
    .sort((a, b) => b.joinedOn.localeCompare(a.joinedOn));
}
