import { SchoolHome } from "@/components/school/school-home";
import { getSiteSchool, listSiteCourses } from "@/server/schools/site";

/**
 * School home page.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain.
 * @returns The school's hero and course catalog.
 */
export default async function SchoolHomePage({ params }: PageProps<"/[locale]/s/[school]">) {
  const { school: subdomain } = await params;
  const [school, courses] = await Promise.all([getSiteSchool(subdomain), listSiteCourses(subdomain)]);
  return <SchoolHome school={school} courses={courses} />;
}
