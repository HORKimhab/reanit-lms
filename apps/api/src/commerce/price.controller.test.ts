import { CourseNotFoundError } from "@reanit/core/catalog";
import { describe, expect, it } from "vitest";

import { setStaffRole, TEST_SCHOOL, useStaffApp } from "../test/session";

const COURSE_ID = "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a99";
const staff = useStaffApp();

/**
 * Sets the course's price as the signed-in staff member.
 *
 * @param payload The request body.
 * @returns The response.
 */
function putPrice(payload: object) {
  return staff.app.inject({ method: "PUT", url: `/courses/${COURSE_ID}/price`, headers: staff.headers, payload });
}

describe("GET /courses/:id/price", () => {
  it("reads the course's current price, null before one is set", async () => {
    setStaffRole(staff.clients, "admin");
    staff.clients.commerce.getPrice.mockResolvedValueOnce({ id: "p", amount: 1500, currency: "USD", billing: { kind: "one_time" } }).mockResolvedValueOnce(null);

    const priced = await staff.app.inject({ method: "GET", url: `/courses/${COURSE_ID}/price`, headers: staff.headers });
    const unpriced = await staff.app.inject({ method: "GET", url: `/courses/${COURSE_ID}/price`, headers: staff.headers });

    expect(priced.json()).toEqual({ price: { amount: 1500, currency: "USD", billing: { kind: "one_time" } } });
    expect(unpriced.json()).toEqual({ price: null });
  });
});

describe("PUT /courses/:id/price", () => {
  it("sets a monthly subscription price", async () => {
    setStaffRole(staff.clients, "owner");
    const billing = { kind: "recurring", interval: "month" } as const;
    staff.clients.commerce.setPrice.mockResolvedValue({ id: "p", amount: 1500, currency: "USD", billing });

    const response = await staff.app.inject({ method: "PUT", url: `/courses/${COURSE_ID}/price`, headers: staff.headers, payload: { amount: 1500, currency: "USD", billing } });

    expect(response.json()).toEqual({ price: { amount: 1500, currency: "USD", billing } });
    expect(staff.clients.commerce.setPrice).toHaveBeenCalledWith(COURSE_ID, { amount: 1500, currency: "USD", billing });
  });

  it("answers 400 for a payment plan of one instalment", async () => {
    setStaffRole(staff.clients, "owner");

    const response = await staff.app.inject({ method: "PUT", url: `/courses/${COURSE_ID}/price`, headers: staff.headers, payload: { amount: 1500, currency: "USD", billing: { kind: "payment_plan", installments: 1 } } });

    expect(response.statusCode).toBe(400);
  });

  it("lets an owner set the price in the school", async () => {
    setStaffRole(staff.clients, "owner");
    staff.clients.commerce.setPrice.mockResolvedValue({ id: "p", amount: 4900, currency: "USD", billing: { kind: "one_time" } });

    const response = await putPrice({ amount: 4900, currency: "USD" });

    expect(response.json()).toEqual({ price: { amount: 4900, currency: "USD", billing: { kind: "one_time" } } });
    expect(staff.clients.commerceFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(staff.clients.commerce.setPrice).toHaveBeenCalledWith(COURSE_ID, { amount: 4900, currency: "USD", billing: { kind: "one_time" } });
  });

  it("refuses an instructor: pricing is for owners and admins", async () => {
    const response = await putPrice({ amount: 4900, currency: "USD" });

    expect(response.statusCode).toBe(403);
    expect(staff.clients.commerce.setPrice).not.toHaveBeenCalled();
  });

  it.each([
    [{ amount: 49.5, currency: "USD" }],
    [{ amount: 0, currency: "USD" }],
    [{ amount: 100, currency: "EUR" }],
  ])("answers 400 for %j", async (payload) => {
    setStaffRole(staff.clients, "owner");

    const response = await putPrice(payload);

    expect(response.statusCode).toBe(400);
  });

  it("answers 404 for another school's course", async () => {
    setStaffRole(staff.clients, "admin");
    staff.clients.commerce.setPrice.mockRejectedValue(new CourseNotFoundError());

    const response = await putPrice({ amount: 4900, currency: "USD" });

    expect(response.statusCode).toBe(404);
  });
});
