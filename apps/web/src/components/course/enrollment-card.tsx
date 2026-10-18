import { Button } from "@reanit/ui/components/button";
import { Card, CardTitle } from "@reanit/ui/components/card";
import { Progress } from "@reanit/ui/components/progress";
import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { MockEnrollment } from "@/mocks/enrollments";

export function EnrollmentCard({ enrollment }: { enrollment: MockEnrollment }) {
  const t = useTranslations("MyCourses");
  const { course, completedLessons, totalLessons, percent } = enrollment;
  const done = completedLessons >= totalLessons;
  const action = done ? "review" : completedLessons === 0 ? "start" : "continue";

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="aspect-video bg-primary/15" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <CardTitle className="text-lg leading-snug">{course.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{course.instructor.name}</p>
        <div className="mt-auto flex flex-col gap-2">
          <Progress value={percent} aria-label={t("progressLabel")} />
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {done ? <CircleCheck className="size-3.5 text-success" /> : null}
            {t("progress", { done: completedLessons, total: totalLessons, percent: Math.round(percent) })}
          </p>
        </div>
        {/* The player route is built in WEB-06. */}
        <Button asChild variant={done ? "outline" : "default"} className="w-full">
          <Link href={`/s/${course.schoolSlug}/learn/${course.slug}`}>{t(action)}</Link>
        </Button>
      </div>
    </Card>
  );
}
