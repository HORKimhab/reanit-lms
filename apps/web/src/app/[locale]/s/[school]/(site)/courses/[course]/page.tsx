import { CourseDetails } from "@/components/course/course-details";
import { getOffer } from "@/server/commerce/checkout";
import { getSiteCourse, getSiteSchool } from "@/server/schools/site";

/**
 * Course sales page. Unknown and draft courses 404.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain and the course slug.
 * @returns The course's sales page.
 * @throws {Error} Next's not-found signal when the school sells no course with that slug.
 */
export default async function CoursePage({ params }: PageProps<"/[locale]/s/[school]/courses/[course]">) {
  const { school: subdomain, course: slug } = await params;
  const courseSlug = decodeURIComponent(slug);
  const [school, course, offer] = await Promise.all([getSiteSchool(subdomain), getSiteCourse(subdomain, courseSlug), getOffer(subdomain, courseSlug)]);
  return (
    <CourseDetails
      course={course}
      instructorName={school.ownerName ?? school.name}
      price={offer.price}
      checkoutHref={`/s/${subdomain}/checkout/${course.slug}`}
    />
  );
}
