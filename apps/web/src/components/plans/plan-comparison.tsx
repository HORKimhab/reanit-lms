import { CREATOR_PLANS, PLAN_CURRENCY, PLAN_TERMS, type CreatorPlan } from "@reanit/core/schools";
import { Check, Minus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type * as React from "react";

import { Cell, DataTable, RowHeader } from "@/components/dashboard/data-table";
import { useMoney } from "@/i18n/format";

import { feeShare } from "./fee";

/** What the comparison compares, row by row. */
const ROWS = ["price", "fee", "publishedCourses", "teamMembers", "customDomain", "offlineQr"] as const;

/**
 * Every creator plan side by side: its price, the platform's fee on each sale, and what it allows.
 *
 * @param props - Component props.
 * @param props.current - The school's plan, marked in its column; left out on the public site.
 * @returns The comparison table.
 */
export function PlanComparison({ current }: { current?: CreatorPlan }) {
  const t = useTranslations("Plans");
  const format = useFormatter();
  const money = useMoney();

  /**
   * Fills one cell: a plan's price, fee, limit or feature.
   *
   * @param row - What the row compares.
   * @param plan - The plan's column.
   * @returns The cell's content: an amount, a count, or a check or dash labelled for screen readers.
   */
  function cell(row: (typeof ROWS)[number], plan: CreatorPlan): React.ReactNode {
    const { prices, feeBasisPoints, limits } = PLAN_TERMS[plan];
    switch (row) {
      case "price":
        return prices ? t("prices", { month: money(prices.month, PLAN_CURRENCY), year: money(prices.year, PLAN_CURRENCY) }) : t("freePrice");
      case "fee":
        return format.number(feeShare(feeBasisPoints), { style: "percent" });
      case "publishedCourses":
      case "teamMembers":
        return limits[row] === null ? t("unlimited") : format.number(limits[row]);
      case "customDomain":
      case "offlineQr":
        return limits[row] ? (
          <Check role="img" aria-hidden={false} aria-label={t("included")} className="ml-auto size-4 text-success" />
        ) : (
          <Minus role="img" aria-hidden={false} aria-label={t("notIncluded")} className="ml-auto size-4 text-muted-foreground" />
        );
    }
  }

  return (
    <DataTable
      caption={t("caption")}
      columns={[{ label: t("feature") }, ...CREATOR_PLANS.map((plan) => ({ label: plan === current ? t("currentName", { plan: t(`names.${plan}`) }) : t(`names.${plan}`), isNumeric: true }))]}
    >
      {ROWS.map((row) => (
        <tr key={row}>
          <RowHeader>{row === "price" || row === "fee" ? t(row) : t(`limits.${row}`)}</RowHeader>
          {CREATOR_PLANS.map((plan) => (
            <Cell key={plan} isNumeric>
              {cell(row, plan)}
            </Cell>
          ))}
        </tr>
      ))}
    </DataTable>
  );
}
