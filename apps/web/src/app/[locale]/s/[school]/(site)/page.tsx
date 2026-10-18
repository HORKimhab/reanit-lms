import { use } from "react";

import { SchoolHome } from "@/components/school/school-home";
import { getMockCourses } from "@/mocks/courses";
import { requireMockSchool } from "@/mocks/schools";

/**
 * School home page.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school slug.
 * @returns The school's hero and course catalog.
 */
export default function SchoolHomePage({ params }: PageProps<"/[locale]/s/[school]">) {
  const { school } = use(params);
  return <SchoolHome school={requireMockSchool(school)} courses={getMockCourses(school)} />;
}
