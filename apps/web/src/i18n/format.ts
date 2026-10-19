import { moneyFormat } from "@reanit/core/commerce";
import { useFormatter } from "next-intl";

/**
 * Gives a formatter that renders stored money in the current locale.
 *
 * @returns A function from (minor-unit amount, currency code) to a localized price string.
 * @example
 * const money = useMoney();
 * money(4900, "USD"); // "$49.00"
 */
export function useMoney() {
  const format = useFormatter();
  return (amountMinor: number, currency: string) => {
    const { value, options } = moneyFormat(amountMinor, currency);
    return format.number(value, options);
  };
}
