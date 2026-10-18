import { Card, CardDescription, CardTitle } from "@reanit/ui/components/card";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { courseStats, type MockCourse } from "@/mocks/courses";

import { Duration } from "./duration";
import { Price } from "./price";

export function CourseCard({ course }: { course: MockCourse }) {
  const t = useTranslations("Course");
  const stats = courseStats(course);
  return (
    <Link href={`/s/${course.schoolSlug}/courses/${course.slug}`} className="group">
      <Card className="h-full gap-0 overflow-hidden p-0 transition-shadow group-hover:shadow-md">
        {/* Cover image placeholder in the school's brand color. */}
        <div className="aspect-video bg-primary/15" />
        <div className="flex flex-1 flex-col gap-3 p-5">
          <CardTitle className="text-lg leading-snug group-hover:text-primary">{course.title}</CardTitle>
          <CardDescription className="line-clamp-2">{course.subtitle}</CardDescription>
          <p className="text-xs text-muted-foreground">
            {course.instructor.name} · {t("lessons", { count: stats.lessons })} · <Duration seconds={stats.durationSec} />
          </p>
          <Price course={course} className="mt-auto" />
        </div>
      </Card>
    </Link>
  );
}
