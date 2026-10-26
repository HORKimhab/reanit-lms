import { SchoolNotFoundError } from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { useTestApp } from "../test/app";
import { signInAs, TEST_SCHOOL, TEST_USER } from "../test/session";

const test = useTestApp();

describe("GET /schools/by-subdomain/:subdomain/orders", () => {
  it("lists the signed-in student's own orders in the school", async () => {
    const headers = signInAs(test.clients);
    test.clients.schools.getSchoolBySubdomain.mockResolvedValue(TEST_SCHOOL);
    test.clients.history.listMyOrders.mockResolvedValue({ orders: [], total: 0, page: 2, pageSize: 50 });

    const response = await test.app.inject({ method: "GET", url: `/schools/by-subdomain/${TEST_SCHOOL.subdomain}/orders?page=2`, headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ orders: [], total: 0, page: 2, pageSize: 50 });
    expect(test.clients.historyFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(test.clients.history.listMyOrders).toHaveBeenCalledWith(TEST_USER.id, { page: 2 });
  });

  it("answers 401 when signed out", async () => {
    const response = await test.app.inject({ method: "GET", url: `/schools/by-subdomain/${TEST_SCHOOL.subdomain}/orders` });

    expect(response.statusCode).toBe(401);
  });

  it("answers 404 for an unknown school", async () => {
    const headers = signInAs(test.clients);
    test.clients.schools.getSchoolBySubdomain.mockRejectedValue(new SchoolNotFoundError());

    const response = await test.app.inject({ method: "GET", url: "/schools/by-subdomain/nowhere/orders", headers });

    expect(response.statusCode).toBe(404);
  });
});

describe("GET /schools/by-subdomain/:subdomain/subscriptions", () => {
  it("lists the student's subscriptions with their price and period end", async () => {
    const headers = signInAs(test.clients);
    test.clients.schools.getSchoolBySubdomain.mockResolvedValue(TEST_SCHOOL);
    const price = { id: "p", amount: 1500, currency: "USD", billing: { kind: "recurring", interval: "month" } } as const;
    test.clients.commerce.listMySubscriptions.mockResolvedValue([
      { id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", status: "lapsed", title: "Design Club", price, courseIds: ["c"], bundleId: null, paidPeriods: 2, currentPeriodEnd: new Date("2026-10-01T00:00:00Z") },
    ]);

    const response = await test.app.inject({ method: "GET", url: `/schools/by-subdomain/${TEST_SCHOOL.subdomain}/subscriptions`, headers });

    expect(response.json()).toEqual({
      subscriptions: [
        {
          id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
          status: "lapsed",
          title: "Design Club",
          price: { amount: 1500, currency: "USD", billing: { kind: "recurring", interval: "month" } },
          paidPeriods: 2,
          currentPeriodEnd: "2026-10-01T00:00:00.000Z",
        },
      ],
    });
    expect(test.clients.commerce.listMySubscriptions).toHaveBeenCalledWith(TEST_USER.id);
  });
});

