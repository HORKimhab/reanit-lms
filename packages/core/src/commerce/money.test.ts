import { describe, expect, it } from "vitest";

import { moneyFormat, toMinorUnits } from "./money";

/**
 * Formats a stored amount the way the web app and emails do.
 *
 * @param locale BCP 47 locale.
 * @param amountMinor Amount in minor units.
 * @param currency ISO code.
 * @returns The displayed amount.
 */
function display(locale: string, amountMinor: number, currency: string) {
  const { value, options } = moneyFormat(amountMinor, currency);
  return new Intl.NumberFormat(locale, options).format(value);
}

describe("moneyFormat", () => {
  it("shows USD cents as dollars with two decimals", () => {
    expect(display("en", 4900, "USD")).toBe("$49.00");
    expect(display("en", 1999, "USD")).toBe("$19.99");
  });

  it("shows riel without decimals, rounding minor units to whole riel", () => {
    expect(display("en", 12_000_000, "KHR")).toBe("KHR 120,000");
    expect(display("en", 12_000_050, "KHR")).toBe("KHR 120,001");
  });

  it("uses Khmer currency formatting for km", () => {
    expect(display("km", 12_000_000, "KHR")).toBe("120,000៛");
    expect(display("km", 4900, "USD")).toBe("49.00$");
  });

  it("treats an unknown currency as having two minor digits", () => {
    expect(moneyFormat(1050, "EUR").value).toBe(10.5);
  });
});

describe("toMinorUnits", () => {
  it.each([
    ["10", "USD", 1000],
    ["10.5", "USD", 1050],
    [" 1,234.99 ", "USD", 123_499],
    ["0.01", "USD", 1],
    ["5,000", "KHR", 500_000],
  ])("reads %j %s as %i minor units", (typed, currency, minor) => {
    expect(toMinorUnits(typed, currency)).toBe(minor);
  });

  it.each([
    ["more decimals than the currency shows", "10.505", "USD"],
    ["decimals on riel", "5000.5", "KHR"],
    ["a negative amount", "-10", "USD"],
    ["nothing", "", "USD"],
    ["text", "ten", "USD"],
  ])("refuses %s", (_case, typed, currency) => {
    expect(toMinorUnits(typed, currency)).toBeNull();
  });
});
