import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { intlWrapper } from "@/test/render";

import { useMoney } from "./format";

/**
 * Gets the money formatter for a locale.
 *
 * @param locale - UI locale.
 * @returns The formatter returned by `useMoney`.
 */
function moneyIn(locale: "en" | "km") {
  return renderHook(() => useMoney(), { wrapper: intlWrapper(locale) }).result.current;
}

describe("useMoney", () => {
  it("formats USD cents as dollars with two decimals", () => {
    expect(moneyIn("en")(4900, "USD")).toBe("$49.00");
  });

  it("keeps cents when the amount is not whole", () => {
    expect(moneyIn("en")(1999, "USD")).toBe("$19.99");
  });

  it("shows riel without decimals", () => {
    expect(moneyIn("en")(12000000, "KHR")).toBe("KHR\u00a0120,000");
  });

  it("rounds riel minor units to whole riel", () => {
    expect(moneyIn("en")(12000050, "KHR")).toBe("KHR\u00a0120,001");
  });

  it("uses Khmer currency formatting when the locale is km", () => {
    expect(moneyIn("km")(12000000, "KHR")).toBe("120,000៛");
    expect(moneyIn("km")(4900, "USD")).toBe("49.00$");
  });

  it("treats an unknown currency as having two minor digits", () => {
    expect(moneyIn("en")(1050, "EUR")).toBe("€10.50");
  });
});
