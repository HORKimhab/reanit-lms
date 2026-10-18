import { useTranslations } from "next-intl";

/**
 * Stand-in body for screens that a later task builds out.
 *
 * @param props - Component props.
 * @param props.title - Page heading.
 * @param props.task - TODO.md task ID that builds the screen.
 * @returns The heading and a "built in <task>" notice.
 */
export function PagePlaceholder({ title, task }: { title: string; task: string }) {
  const t = useTranslations("Common");
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("comingSoon", { task })}
      </p>
    </div>
  );
}
