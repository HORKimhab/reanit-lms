import type { PriceInput } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";

import { useMoney } from "@/i18n/format";

/**
 * Gives a formatter that says what a price costs and how often: "$49.00", "$15.00 / month" or
 * "4 payments of $25.00", in the current locale.
 *
 * @returns A function from a price to its label.
 * @example
 * const priceLabel = usePriceLabel();
 * priceLabel({ amount: 1500, currency: "USD", billing: { kind: "recurring", interval: "month" } }); // "$15.00 / month"
 */
export function usePriceLabel() {
  const t = useTranslations("Pricing");
  const money = useMoney();
  return (price: PriceInput) => {
    const amount = money(price.amount, price.currency);
    switch (price.billing.kind) {
      case "one_time":
        return amount;
      case "recurring":
        return t(`per.${price.billing.interval}`, { amount });
      case "payment_plan":
        return t("installments", { count: price.billing.installments, amount });
    }
  };
}
