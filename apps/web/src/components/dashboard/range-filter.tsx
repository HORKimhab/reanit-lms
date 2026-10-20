import { Button } from "@reanit/ui/components/button";
import { cn } from "@reanit/ui/lib/utils";
import { useTranslations } from "next-intl";

import { INPUT_CLASS } from "@/components/form/field";
import { Link } from "@/i18n/navigation";

import { presetRange, RANGE_PRESETS } from "./range-presets";

/** Where the analytics page lives; the filter's links and form stay on it. */
const ANALYTICS_PATH = "/dashboard/analytics";

/**
 * The analytics date range, in one row above everything it scopes: presets first, then a custom range.
 *
 * @param props - Component props.
 * @param props.from - The range's first day, `YYYY-MM-DD`.
 * @param props.to - The range's last day, `YYYY-MM-DD`.
 * @param props.now - The current time, for the presets.
 * @returns The preset links and the custom range form.
 */
export function RangeFilter({ from, to, now }: { from: string; to: string; now: Date }) {
  const t = useTranslations("Analytics");

  return (
    <div className="flex flex-wrap items-end gap-3">
      <nav aria-label={t("range")} className="flex flex-wrap gap-2 text-sm">
        {RANGE_PRESETS.map((days) => {
          const range = presetRange(days, now);
          const isCurrent = range.from === from && range.to === to;
          return (
            <Link
              key={days}
              href={{ pathname: ANALYTICS_PATH, query: range }}
              aria-current={isCurrent ? "page" : undefined}
              className={cn("rounded-full border px-3 py-1", isCurrent && "border-primary bg-primary/10 font-medium")}
            >
              {t(`presets.${days}`)}
            </Link>
          );
        })}
      </nav>
      <form action={ANALYTICS_PATH} className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          {t("from")}
          <input type="date" name="from" defaultValue={from} required className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1">
          {t("to")}
          <input type="date" name="to" defaultValue={to} required className={INPUT_CLASS} />
        </label>
        <Button type="submit" variant="outline">
          {t("apply")}
        </Button>
      </form>
    </div>
  );
}
