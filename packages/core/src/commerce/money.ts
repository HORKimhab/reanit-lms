/** Minor-unit digits per currency (the ISO 4217 exponent); an unknown currency gets two. */
const MINOR_DIGITS: Record<string, number> = { USD: 2, KHR: 2 };
const DEFAULT_MINOR_DIGITS = 2;
/** Digits shown per currency when it differs from the stored ones: riel is never shown with decimals. */
const DISPLAY_DIGITS: Record<string, number> = { KHR: 0 };

/** The number-format options money needs; a subset both `Intl.NumberFormat` and next-intl's formatter accept. */
type MoneyFormatOptions = { style: "currency"; currency: string; minimumFractionDigits?: number; maximumFractionDigits?: number };

/**
 * Turns a stored amount into the number and `Intl.NumberFormat` options that display it, so the
 * web app and emails format money the same way in every locale.
 *
 * @param amountMinor Amount in integer minor units.
 * @param currency ISO 4217 code.
 * @returns The amount in major units and the currency options.
 * @example
 * const { value, options } = moneyFormat(4900, "USD");
 * new Intl.NumberFormat("en", options).format(value); // "$49.00"
 */
export function moneyFormat(amountMinor: number, currency: string): { value: number; options: MoneyFormatOptions } {
  const digits = DISPLAY_DIGITS[currency];
  return {
    value: amountMinor / 10 ** (MINOR_DIGITS[currency] ?? DEFAULT_MINOR_DIGITS),
    options: { style: "currency", currency, ...(digits !== undefined && { minimumFractionDigits: digits, maximumFractionDigits: digits }) },
  };
}
