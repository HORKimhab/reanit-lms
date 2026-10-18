import { useTranslations } from "next-intl";
import { use } from "react";

import { CourseCard } from "@/components/course/course-card";
import { getMockCourses } from "@/mocks/courses";
import { getMockSchool, type MockSchool } from "@/mocks/schools";

export default function SchoolHome({ params }: { params: Promise<{ school: string }> }) {
  const { school: slug } = use(params);
  const school = getMockSchool(slug) as MockSchool;
  const courses = getMockCourses(slug);
  const t = useTranslations("School");

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-start gap-3 rounded-2xl bg-primary/10 px-6 py-12 sm:px-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{school.name}</h1>
        <p className="max-w-xl text-lg text-muted-foreground">{school.tagline}</p>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">{t("coursesHeading")}</h2>
        {courses.length === 0 ? (
          <p className="text-muted-foreground">{t("noCourses")}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.slug} course={course} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
