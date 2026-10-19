import { CourseNotFoundError } from "@reanit/core/catalog";
import { describe, expect, it } from "vitest";

import { TEST_SCHOOL, useStaffApp } from "../test/session";

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

describe("PUT /courses/:id/price", () => {
  it("lets an owner set the price in the school", async () => {
    staff.clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "owner" });
    staff.clients.commerce.setPrice.mockResolvedValue({ id: "p", amount: 4900, currency: "USD" });

    const response = await putPrice({ amount: 4900, currency: "USD" });

    expect(response.json()).toEqual({ price: { amount: 4900, currency: "USD" } });
    expect(staff.clients.commerceFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(staff.clients.commerce.setPrice).toHaveBeenCalledWith(COURSE_ID, { amount: 4900, currency: "USD" });
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
    staff.clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "owner" });

    const response = await putPrice(payload);

    expect(response.statusCode).toBe(400);
  });

  it("answers 404 for another school's course", async () => {
    staff.clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "admin" });
    staff.clients.commerce.setPrice.mockRejectedValue(new CourseNotFoundError());

    const response = await putPrice({ amount: 4900, currency: "USD" });

    expect(response.statusCode).toBe(404);
  });
});
