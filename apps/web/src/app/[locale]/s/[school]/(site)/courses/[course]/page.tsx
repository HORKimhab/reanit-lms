import { notFound } from "next/navigation";
import { use } from "react";

import { CourseDetails } from "@/components/course/course-details";
import { getMockCourse } from "@/mocks/courses";

/**
 * Course sales page. Unknown courses 404.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school and course slugs.
 * @returns The course's sales page.
 * @throws {Error} Next's not-found signal when the school has no course with that slug.
 */
export default function CoursePage({ params }: PageProps<"/[locale]/s/[school]/courses/[course]">) {
  const { school, course: slug } = use(params);
  const course = getMockCourse(school, slug);
  if (!course) notFound();
  return <CourseDetails course={course} />;
}
