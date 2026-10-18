import { useFormatter } from "next-intl";

// Prices are stored as integer minor units (ISO 4217 exponent) + currency code.
const MINOR_DIGITS: Record<string, number> = { USD: 2, KHR: 2 };
// Riel is never shown with decimals.
const DISPLAY_DIGITS: Record<string, number> = { KHR: 0 };

export function toMajor(amountMinor: number, currency: string) {
  return amountMinor / 10 ** (MINOR_DIGITS[currency] ?? 2);
}

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
