import { useTranslations } from "next-intl";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/**
 * Shows a running time as "45 min" or "2 h 5 min", rounded to the minute (at least 1 min).
 *
 * @param props - Component props.
 * @param props.seconds - Duration in seconds.
 * @returns The localized duration, or nothing for zero (e.g. PDFs).
 */
export function Duration({ seconds }: { seconds: number }) {
  const t = useTranslations("Course");
  if (seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / SECONDS_PER_MINUTE));
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = minutes % MINUTES_PER_HOUR;
  return <>{h > 0 ? t("hoursMinutes", { h, m }) : t("minutes", { m })}</>;
}
