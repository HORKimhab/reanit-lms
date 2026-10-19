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

// The amounts' rules (minor units, riel without decimals) are tested with `moneyFormat` in @reanit/core.
describe("useMoney", () => {
  it("formats stored money in the current locale", () => {
    expect(moneyIn("en")(4900, "USD")).toBe("$49.00");
    expect(moneyIn("en")(12000000, "KHR")).toBe("KHR\u00a0120,000");
  });

  it("uses Khmer currency formatting when the locale is km", () => {
    expect(moneyIn("km")(12000000, "KHR")).toBe("120,000៛");
    expect(moneyIn("km")(4900, "USD")).toBe("49.00$");
  });
});
