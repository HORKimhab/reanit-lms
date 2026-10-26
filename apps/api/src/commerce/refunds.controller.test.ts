import { OrderNotFoundError, OrderNotRefundableError, RefundByHandRequiredError } from "@reanit/core/commerce";
import { describe, expect, it } from "vitest";

import { TEST_SCHOOL, useStaffApp } from "../test/session";

const ORDER_ID = "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d";
const staff = useStaffApp();

/** Makes the signed-in staff member an owner, who refunds orders. */
function asOwner() {
  staff.clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "owner" });
}

describe("POST /orders/:id/refund", () => {
  it("refunds the caller's school's order, through the gateway unless staff say otherwise", async () => {
    asOwner();
    staff.clients.commerce.refundOrder.mockResolvedValue(undefined);

    const response = await staff.app.inject({ method: "POST", url: `/orders/${ORDER_ID}/refund`, headers: staff.headers, payload: {} });

    expect(response.statusCode).toBe(204);
    expect(staff.clients.commerceFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(staff.clients.commerce.refundOrder).toHaveBeenCalledWith(ORDER_ID, { isRefundedByHand: false });
  });

  it("passes on that staff refunded by hand", async () => {
    asOwner();
    staff.clients.commerce.refundOrder.mockResolvedValue(undefined);

    await staff.app.inject({ method: "POST", url: `/orders/${ORDER_ID}/refund`, headers: staff.headers, payload: { isRefundedByHand: true } });

    expect(staff.clients.commerce.refundOrder).toHaveBeenCalledWith(ORDER_ID, { isRefundedByHand: true });
  });

  it("refuses an instructor: refunds are for owners and admins", async () => {
    const response = await staff.app.inject({ method: "POST", url: `/orders/${ORDER_ID}/refund`, headers: staff.headers, payload: {} });

    expect(response.statusCode).toBe(403);
    expect(staff.clients.commerce.refundOrder).not.toHaveBeenCalled();
  });

  it.each([
    [new OrderNotFoundError(), 404, "order-not-found"],
    [new OrderNotRefundableError(), 409, "order-not-refundable"],
    [new RefundByHandRequiredError(), 409, "refund-by-hand-required"],
  ])("maps %s to %i", async (error, status, code) => {
    asOwner();
    staff.clients.commerce.refundOrder.mockRejectedValue(error);

    const response = await staff.app.inject({ method: "POST", url: `/orders/${ORDER_ID}/refund`, headers: staff.headers, payload: {} });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ type: `urn:reanit:problem:${code}` });
  });
});
