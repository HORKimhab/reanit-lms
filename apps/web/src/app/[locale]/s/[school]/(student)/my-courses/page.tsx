import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { use } from "react";

import { EnrollmentCard } from "@/components/course/enrollment-card";
import { Link } from "@/i18n/navigation";
import { getMockEnrollments, type MockEnrollment } from "@/mocks/enrollments";

/**
 * Student's "My courses": enrollments split into in progress and completed.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school slug.
 * @returns The grouped enrollment cards, or an empty state linking to the catalog.
 */
export default function MyCourses({ params }: PageProps<"/[locale]/s/[school]/my-courses">) {
  const { school } = use(params);
  const enrollments = getMockEnrollments(school);
  const t = useTranslations("MyCourses");

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
      <Group title={t("inProgress")} items={enrollments.filter((e) => !e.isCompleted)} />
      <Group title={t("completed")} items={enrollments.filter((e) => e.isCompleted)} />
    </div>
  );
}

/**
 * One headed grid of enrollment cards.
 *
 * @param props - Component props.
 * @param props.title - Group heading.
 * @param props.items - Enrollments in the group.
 * @returns The section, or nothing when the group is empty.
 */
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
