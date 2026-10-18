import { use } from "react";

import { MyCourseList } from "@/components/course/my-course-list";
import { getMockEnrollments } from "@/mocks/enrollments";

/**
 * Student's "My courses" page.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school slug.
 * @returns The student's enrollments in the school.
 */
export default function MyCourses({ params }: PageProps<"/[locale]/s/[school]/my-courses">) {
  const { school } = use(params);
  return <MyCourseList school={school} enrollments={getMockEnrollments(school)} />;
}
