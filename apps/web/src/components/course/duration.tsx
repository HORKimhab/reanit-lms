import { useTranslations } from "next-intl";

// "45 min" or "2 h 5 min". Empty for zero (e.g. PDFs).
export function Duration({ seconds }: { seconds: number }) {
  const t = useTranslations("Course");
  if (seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return <>{h > 0 ? t("hoursMinutes", { h, m }) : t("minutes", { m })}</>;
}
