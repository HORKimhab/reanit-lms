// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { getMySubscription, listMySubscriptions, renewPath } from "./subscriptions";

vi.mock("next/headers", () => import("@/test/headers"));

const ROUTE = "GET /schools/by-subdomain/angkor/subscriptions";
const SUBSCRIPTION = {
  id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a30",
  status: "active",
  title: "Design Club",
  price: { amount: 1500, currency: "USD", billing: { kind: "recurring", interval: "month" } },
  methods: ["offline_qr", "aba_payway"],
  paidPeriods: 2,
  currentPeriodEnd: "2026-11-01T09:00:00.000Z",
};

beforeEach(() => {
  signIn();
});

describe("listMySubscriptions", () => {
  it("returns the student's subscriptions with their period end as a date", async () => {
    onApi(ROUTE, Response.json({ subscriptions: [SUBSCRIPTION] }));

    expect(await listMySubscriptions("angkor", "/s/angkor/purchases")).toEqual([{ ...SUBSCRIPTION, currentPeriodEnd: new Date("2026-11-01T09:00:00Z") }]);
  });

  it("sends a signed-out visitor to log in and come back", async () => {
    onApi(ROUTE, problem(401));

    await expect(listMySubscriptions("angkor", "/s/angkor/purchases")).rejects.toThrow(RedirectError);
  });
});

describe("getMySubscription", () => {
  it("finds one of the student's subscriptions, and is not found for another", async () => {
    onApi(ROUTE, Response.json({ subscriptions: [SUBSCRIPTION] }));

    expect((await getMySubscription("angkor", SUBSCRIPTION.id)).title).toBe("Design Club");
    await expect(getMySubscription("angkor", "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a99")).rejects.toThrow(NotFoundError);
  });
});

describe("renewPath", () => {
  it("is the page that pays a subscription's next period", () => {
    expect(renewPath("angkor", SUBSCRIPTION.id)).toBe(`/s/angkor/renew/${SUBSCRIPTION.id}`);
  });
});
