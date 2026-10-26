import { describe, expect, it } from "vitest";

import { planGuardOn } from "../test/plan-fakes";
import { PlanLimitError } from "./errors";
import { currentPlan, platformFee } from "./plans";

describe("currentPlan", () => {
  const PERIOD_END = new Date("2026-11-01T00:00:00Z");

  it("keeps a paid plan through its period and a week's grace, then falls back to Free", () => {
    expect(currentPlan({ plan: "pro", interval: "month", periodEnd: PERIOD_END }, new Date("2026-11-07T23:59:59Z"))).toBe("pro");
    expect(currentPlan({ plan: "pro", interval: "month", periodEnd: PERIOD_END }, new Date("2026-11-08T00:00:00Z"))).toBe("free");
  });

  it("is Free for a school that never paid", () => {
    expect(currentPlan({ plan: "free", interval: null, periodEnd: null }, PERIOD_END)).toBe("free");
  });
});

describe("platformFee", () => {
  it.each([
    ["free", 4900, "USD", 490],
    ["pro", 4900, "USD", 245],
    ["business", 4999, "USD", 100],
  ] as const)("takes the %s plan's share of %i %s", (plan, amount, currency, fee) => {
    expect(platformFee(amount, currency, plan)).toBe(fee);
  });

  it("rounds a riel fee to whole riel", () => {
    expect(platformFee(1_234_500, "KHR", "pro")).toBe(61_700);
  });
});

describe("plan guard", () => {
  it("refuses one more than Free's published courses, and allows any number on Pro", async () => {
    await expect(planGuardOn("free").assertWithin("publishedCourses", 2)).resolves.toBeUndefined();
    await expect(planGuardOn("free").assertWithin("publishedCourses", 3)).rejects.toThrow(new PlanLimitError("publishedCourses"));
    await expect(planGuardOn("pro").assertWithin("publishedCourses", 500)).resolves.toBeUndefined();
  });

  it("allows Pro three team members and Business any number", async () => {
    await expect(planGuardOn("pro").assertWithin("teamMembers", 3)).rejects.toThrow(PlanLimitError);
    await expect(planGuardOn("business").assertWithin("teamMembers", 50)).resolves.toBeUndefined();
  });

  it("leaves a custom domain and the offline QR out of Free", async () => {
    await expect(planGuardOn("free").assertAllows("customDomain")).rejects.toThrow(new PlanLimitError("customDomain"));
    expect(await planGuardOn("free").allows("offlineQr")).toBe(false);
    expect(await planGuardOn("pro").allows("offlineQr")).toBe(true);
  });
});
