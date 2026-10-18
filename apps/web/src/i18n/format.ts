import { useFormatter } from "next-intl";

// Prices are stored as integer minor units (ISO 4217 exponent) + currency code.
const MINOR_DIGITS: Record<string, number> = { USD: 2, KHR: 2 };
const DEFAULT_MINOR_DIGITS = 2;
// Riel is never shown with decimals.
const DISPLAY_DIGITS: Record<string, number> = { KHR: 0 };

/**
 * Converts an integer minor-unit amount to major units (4900 USD cents → 49).
 *
 * @param amountMinor - Amount in minor units.
 * @param currency - ISO 4217 currency code.
 * @returns The amount in major units.
 */
function toMajor(amountMinor: number, currency: string) {
  return amountMinor / 10 ** (MINOR_DIGITS[currency] ?? DEFAULT_MINOR_DIGITS);
}

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
    const digits = DISPLAY_DIGITS[currency];
    return format.number(toMajor(amountMinor, currency), {
      style: "currency",
      currency,
      ...(digits === undefined ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    });
  };
}
