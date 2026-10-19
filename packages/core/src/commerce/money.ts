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

/**
 * Reads an amount a person typed in major units ("10.50", "5,000") into integer minor units, allowing
 * only as many decimals as the currency shows (none for riel).
 *
 * @param typed The amount as typed; thousands separators are ignored.
 * @param currency ISO 4217 code.
 * @returns The amount in minor units, or null when it is not a plain non-negative number with the allowed decimals.
 * @example
 * toMinorUnits("10.5", "USD"); // 1050
 * toMinorUnits("5,000", "KHR"); // 500000
 */
export function toMinorUnits(typed: string, currency: string): number | null {
  const minorDigits = MINOR_DIGITS[currency] ?? DEFAULT_MINOR_DIGITS;
  const shownDigits = DISPLAY_DIGITS[currency] ?? minorDigits;
  const fractionPattern = shownDigits > 0 ? `(?:\\.(\\d{1,${shownDigits}}))?` : "";
  const match = new RegExp(`^(\\d+)${fractionPattern}$`).exec(typed.trim().replaceAll(",", ""));
  if (!match) return null;
  const [, whole = "", fraction = ""] = match;
  return Number(whole) * 10 ** minorDigits + Number(fraction.padEnd(minorDigits, "0"));
}
