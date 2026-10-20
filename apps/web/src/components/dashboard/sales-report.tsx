import type { SalesReport as Report } from "@reanit/core/analytics";
import { useFormatter, useTranslations } from "next-intl";

import { useMoney } from "@/i18n/format";

import { CompletionFunnel } from "./completion-funnel";
import { CourseTitleCell } from "./course-table";
import { DailyRevenueChart } from "./daily-revenue-chart";
import { Cell, DataTable } from "./data-table";
import { RevenueList } from "./revenue-list";
import { StatTile } from "./stat-tile";

/**
 * A school's sales over a range: revenue, sales and refunds, revenue per day for each currency (charts
 * never mix currencies), the completion funnel, and sales per course.
 *
 * @param props - Component props.
 * @param props.report - The report.
 * @returns The tiles, charts and table.
 */
export function SalesReport({ report }: { report: Report }) {
  const t = useTranslations("Analytics");
  const format = useFormatter();
  const money = useMoney();
  const currencies = report.totals.revenue.map(({ currency }) => currency);

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-4 sm:grid-cols-3">
        <StatTile label={t("revenue")}>
          <RevenueList revenue={report.totals.revenue} />
        </StatTile>
        <StatTile label={t("sales")}>{format.number(report.totals.sales)}</StatTile>
        <StatTile label={t("refunds")}>
          {report.refunds.length === 0
            ? t("noRefunds")
            : report.refunds.map(({ currency, amount, orders }) => (
                <span key={currency}>
                  {money(amount, currency)} <span className="text-sm font-normal text-muted-foreground">{t("refundOrders", { count: orders })}</span>
                </span>
              ))}
        </StatTile>
      </dl>
      <div className="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          {currencies.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{t("dailyEmpty")}</p> : null}
          {currencies.map((currency) => (
            <DailyRevenueChart
              key={currency}
              currency={currency}
              days={report.daily.map(({ day, sales, revenue }) => ({ day, sales, amount: revenue.find((entry) => entry.currency === currency)?.amount ?? 0 }))}
            />
          ))}
        </div>
        <CompletionFunnel funnel={report.funnel} />
      </div>
      {report.byCourse.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{t("byCourse")}</h2>
          <DataTable caption={t("byCourse")} columns={[{ label: t("course") }, { label: t("sales"), isNumeric: true }, { label: t("revenue"), isNumeric: true }]}>
            {report.byCourse.map((course) => (
              <tr key={course.courseId}>
                <CourseTitleCell course={course} />
                <Cell isNumeric>{format.number(course.sales)}</Cell>
                <Cell isNumeric>
                  <RevenueList revenue={course.revenue} />
                </Cell>
              </tr>
            ))}
          </DataTable>
        </section>
      ) : null}
    </div>
  );
}
