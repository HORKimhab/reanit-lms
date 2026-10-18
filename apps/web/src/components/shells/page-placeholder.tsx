import { useTranslations } from "next-intl";

// Stand-in body for screens that later tasks build out.
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
