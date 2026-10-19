import { describe, expect, it } from "vitest";

import { priceSchema } from "./rules";

describe("priceSchema", () => {
  it.each([
    [{ amount: 4999, currency: "USD" }],
    [{ amount: 2_000_000, currency: "KHR" }],
  ])("accepts %j", (price) => {
    expect(priceSchema.parse(price)).toEqual(price);
  });

  it.each([
    ["a fraction of a riel", { amount: 2_000_050, currency: "KHR" }],
    ["a fractional amount", { amount: 49.5, currency: "USD" }],
    ["zero", { amount: 0, currency: "USD" }],
    ["another currency", { amount: 100, currency: "EUR" }],
  ])("rejects %s", (_case, price) => {
    expect(priceSchema.safeParse(price).success).toBe(false);
  });
});
