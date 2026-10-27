import type { SchoolPlan } from "@reanit/core/schools";
import { useFormatter, useTranslations } from "next-intl";

import { feeShare } from "./fee";

/**
 * The school's plan in force: its name, its fee on each sale, and until when it is paid, or that a paid
 * plan ran out and the school is back on Free.
 *
 * @param props - Component props.
 * @param props.plan - The school's plan.
 * @returns A labelled card.
 */
export function CurrentPlan({ plan }: { plan: SchoolPlan }) {
  const t = useTranslations("Plans");
  const format = useFormatter();
  const percent = format.number(feeShare(plan.terms.feeBasisPoints), { style: "percent" });
  const { paid } = plan;

  return (
    <section aria-labelledby="current-plan" className="flex flex-col gap-2 rounded-xl border p-5">
      <h2 id="current-plan" className="text-lg font-semibold">
        {t("currentTitle", { plan: t(`names.${plan.plan}`) })}
      </h2>
      <p className="text-sm text-muted-foreground">{t("feeLine", { percent })}</p>
      {paid && plan.plan !== "free" ? (
        <p className="text-sm">{t("paidUntil", { date: format.dateTime(paid.periodEnd, { dateStyle: "medium" }), interval: t(`intervals.${paid.interval}`) })}</p>
      ) : null}
      {paid && plan.plan === "free" ? (
        <p role="alert" className="text-sm text-destructive">
          {t("lapsed", { plan: t(`names.${paid.plan}`), date: format.dateTime(paid.periodEnd, { dateStyle: "medium" }) })}
        </p>
      ) : null}
    </section>
  );
}
