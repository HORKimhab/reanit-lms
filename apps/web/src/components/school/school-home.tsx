import type { Course } from "@reanit/core/catalog";
import { useTranslations } from "next-intl";

import { CourseCard } from "@/components/course/course-card";
import type { SiteSchool } from "@/server/schools/site";

/**
 * School home: hero with the school's name and tagline, then its course catalog.
 *
 * @param props - Component props.
 * @param props.school - The school.
 * @param props.courses - The school's published courses, in display order.
 * @returns The hero and a grid of course cards, or an empty notice.
 */
export function SchoolHome({ school, courses }: { school: SiteSchool; courses: Course[] }) {
  const t = useTranslations("School");

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-start gap-3 rounded-2xl bg-primary/10 px-6 py-12 sm:px-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{school.name}</h1>
        {school.tagline ? <p className="max-w-xl text-lg text-muted-foreground">{school.tagline}</p> : null}
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">{t("coursesHeading")}</h2>
        {courses.length === 0 ? (
          <p className="text-muted-foreground">{t("noCourses")}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                schoolSlug={school.slug}
                instructorName={school.ownerName ?? school.name}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
