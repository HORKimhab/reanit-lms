import type { Revenue } from "@reanit/core/analytics";
import { useTranslations } from "next-intl";

import { useMoney } from "@/i18n/format";

/**
 * Revenue with one line per currency, since amounts in different currencies are never added together.
 *
 * @param props - Component props.
 * @param props.revenue - Amounts per currency, in display order.
 * @returns The localized amounts stacked, or "No sales yet" when the list is empty.
 */
export function RevenueList({ revenue }: { revenue: Revenue[] }) {
  const t = useTranslations("Dashboard");
  const money = useMoney();

  if (revenue.length === 0) return t("noSales");

  return (
    <span className="flex flex-col">
      {revenue.map(({ currency, amount }) => (
        <span key={currency}>{money(amount, currency)}</span>
      ))}
    </span>
  );
}
