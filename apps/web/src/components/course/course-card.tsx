import type { Course } from "@reanit/core/catalog";
import { Card, CardDescription, CardTitle } from "@reanit/ui/components/card";

import { Link } from "@/i18n/navigation";

/**
 * Catalog card linking to a course's sales page.
 *
 * @param props - Component props.
 * @param props.course - The course to show.
 * @param props.schoolSlug - The school's subdomain, for the link.
 * @param props.instructorName - Who teaches it.
 * @returns A linked card with cover, title, description and instructor.
 */
export function CourseCard({ course, schoolSlug, instructorName }: { course: Course; schoolSlug: string; instructorName: string }) {
  return (
    <Link href={`/s/${schoolSlug}/courses/${course.slug}`} className="group">
      <Card className="h-full gap-0 overflow-hidden p-0 transition-shadow group-hover:shadow-md">
        {/* Cover image placeholder in the school's brand color. */}
        <div className="aspect-video bg-primary/15" />
        <div className="flex flex-1 flex-col gap-3 p-5">
          <CardTitle className="text-lg leading-snug group-hover:text-primary">{course.title}</CardTitle>
          {course.description ? <CardDescription className="line-clamp-2">{course.description}</CardDescription> : null}
          <p className="mt-auto text-xs text-muted-foreground">{instructorName}</p>
        </div>
      </Card>
    </Link>
  );
}
