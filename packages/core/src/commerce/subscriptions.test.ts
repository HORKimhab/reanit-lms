import { describe, expect, it } from "vitest";

import { currentStatus, renewSubscription } from "./subscriptions";

const MONTHLY = { kind: "recurring", interval: "month" } as const;
const YEARLY = { kind: "recurring", interval: "year" } as const;
const PLAN_OF_3 = { kind: "payment_plan", installments: 3 } as const;

describe("renewSubscription", () => {
  it("starts the first period at the payment and gives access until a week after it ends", () => {
    expect(renewSubscription({ billing: MONTHLY, paidPeriods: 0, currentPeriodEnd: null }, new Date("2026-10-27T09:00:00Z"))).toEqual({
      paidPeriods: 1,
      currentPeriodEnd: new Date("2026-11-27T09:00:00Z"),
      status: "active",
      accessUntil: new Date("2026-12-04T09:00:00Z"),
    });
  });

  it("continues from the end of the current period when paid early", () => {
    const change = renewSubscription({ billing: YEARLY, paidPeriods: 1, currentPeriodEnd: new Date("2027-01-15T00:00:00Z") }, new Date("2027-01-10T00:00:00Z"));

    expect(change.currentPeriodEnd).toEqual(new Date("2028-01-15T00:00:00Z"));
    expect(change.paidPeriods).toBe(2);
  });

  it("starts again from the payment after a lapse", () => {
    const change = renewSubscription({ billing: MONTHLY, paidPeriods: 3, currentPeriodEnd: new Date("2026-06-01T00:00:00Z") }, new Date("2026-10-27T00:00:00Z"));

    expect(change.currentPeriodEnd).toEqual(new Date("2026-11-27T00:00:00Z"));
  });

  it("ends on the last day of a shorter month", () => {
    expect(renewSubscription({ billing: MONTHLY, paidPeriods: 0, currentPeriodEnd: null }, new Date("2027-01-31T09:00:00Z")).currentPeriodEnd).toEqual(
      new Date("2027-02-28T09:00:00Z"),
    );
    expect(renewSubscription({ billing: MONTHLY, paidPeriods: 0, currentPeriodEnd: null }, new Date("2028-01-31T09:00:00Z")).currentPeriodEnd).toEqual(
      new Date("2028-02-29T09:00:00Z"),
    );
  });

  it("bills a payment plan monthly and keeps access open until its last instalment", () => {
    const change = renewSubscription({ billing: PLAN_OF_3, paidPeriods: 1, currentPeriodEnd: new Date("2026-11-27T00:00:00Z") }, new Date("2026-11-20T00:00:00Z"));

    expect(change).toEqual({ paidPeriods: 2, currentPeriodEnd: new Date("2026-12-27T00:00:00Z"), status: "active", accessUntil: new Date("2027-01-03T00:00:00Z") });
  });

  it("completes a payment plan on its last instalment, with access for good", () => {
    const change = renewSubscription({ billing: PLAN_OF_3, paidPeriods: 2, currentPeriodEnd: new Date("2026-12-27T00:00:00Z") }, new Date("2026-12-20T00:00:00Z"));

    expect(change).toMatchObject({ paidPeriods: 3, status: "completed", accessUntil: null });
  });
});

describe("currentStatus", () => {
  const PERIOD_END = new Date("2026-11-27T00:00:00Z");

  it("keeps an active subscription active through its grace week", () => {
    expect(currentStatus({ status: "active", currentPeriodEnd: PERIOD_END }, new Date("2026-12-03T23:59:59Z"))).toBe("active");
  });

  it("shows an active subscription as lapsed once its grace week has passed", () => {
    expect(currentStatus({ status: "active", currentPeriodEnd: PERIOD_END }, new Date("2026-12-04T00:00:00Z"))).toBe("lapsed");
  });

  it.each(["pending", "completed", "lapsed"] as const)("leaves a %s subscription as it is", (status) => {
    expect(currentStatus({ status, currentPeriodEnd: PERIOD_END }, new Date("2030-01-01T00:00:00Z"))).toBe(status);
  });
});
