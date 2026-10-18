import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { use } from "react";

import { EnrollmentCard } from "@/components/course/enrollment-card";
import { Link } from "@/i18n/navigation";
import { getMockEnrollments, type MockEnrollment } from "@/mocks/enrollments";

export default function MyCourses({ params }: { params: Promise<{ school: string }> }) {
  const { school } = use(params);
  const enrollments = getMockEnrollments(school);
  const t = useTranslations("MyCourses");
  const inProgress = enrollments.filter((e) => e.completedLessons < e.totalLessons);
  const completed = enrollments.filter((e) => e.completedLessons >= e.totalLessons);

  if (enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">{t("emptyTitle")}</h1>
        <p className="text-muted-foreground">{t("emptyText")}</p>
        <Button asChild>
          <Link href={`/s/${school}`}>{t("browse")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Group title={t("inProgress")} items={inProgress} />
      <Group title={t("completed")} items={completed} />
    </div>
  );
}

function Group({ title, items }: { title: string; items: MockEnrollment[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((e) => (
          <EnrollmentCard key={e.course.slug} enrollment={e} />
        ))}
      </div>
    </section>
  );
}
