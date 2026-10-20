import { salesQuerySchema } from "@reanit/core/analytics";
import { getTranslations } from "next-intl/server";

import { RangeFilter } from "@/components/dashboard/range-filter";
import { isoDay } from "@/components/dashboard/range-presets";
import { SalesReport } from "@/components/dashboard/sales-report";
import { getSalesReport } from "@/server/analytics/sales";

/**
 * Analytics: the school's sales over a range of days, with the range filter above. A range the API
 * refuses (backwards, longer than a year) shows why instead of a report.
 *
 * @param props - Page props.
 * @param props.searchParams - `from` and `to`, `YYYY-MM-DD`; the last 30 days when missing or malformed.
 * @returns The heading, the range filter and the report.
 */
export default async function DashboardAnalytics({ searchParams }: PageProps<"/[locale]/dashboard/analytics">) {
  const parsed = salesQuerySchema.safeParse(await searchParams);
  const [t, nav, report] = await Promise.all([getTranslations("Analytics"), getTranslations("DashboardNav"), getSalesReport(parsed.success ? parsed.data : {})]);
  const asked = parsed.success ? parsed.data : {};
  const from = report ? isoDay(report.range.from) : (asked.from ?? "");
  const to = report ? isoDay(report.range.to) : (asked.to ?? "");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("analytics")}</h1>
      <RangeFilter from={from} to={to} now={new Date()} />
      {report ? (
        <SalesReport report={report} />
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t("invalidRange")}
        </p>
      )}
    </div>
  );
}
