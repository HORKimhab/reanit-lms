import { OrderNotFoundError, OrderNotRefundableError, RefundByHandRequiredError } from "@reanit/core/commerce";
import type { OrderDetail } from "@reanit/core/commerce";
import { describe, expect, it } from "vitest";

import { TEST_SCHOOL, useStaffApp } from "../test/session";

const ORDER_ID = "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d";
const staff = useStaffApp();
const ORDER: OrderDetail = {
  id: ORDER_ID,
  status: "refunded",
  method: "bakong_khqr",
  total: { amount: 200_000, currency: "KHR" },
  items: [{ courseId: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01", title: "Brand", amount: 200_000, currency: "KHR" }],
  bundleTitle: null,
  couponCode: "SAVE20",
  buyer: { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a02", name: null, email: "sokha@example.com" },
  createdAt: new Date("2026-10-20T08:00:00Z"),
  paidAt: new Date("2026-10-20T08:01:00Z"),
  refundedAt: new Date("2026-10-21T09:00:00Z"),
  isRefundedByHand: true,
};
const ORDER_JSON = { ...ORDER, createdAt: "2026-10-20T08:00:00.000Z", paidAt: "2026-10-20T08:01:00.000Z", refundedAt: "2026-10-21T09:00:00.000Z" };

/** Makes the signed-in staff member an owner, who sees and refunds orders. */
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

describe("GET /orders", () => {
  it("lists the caller's school's orders with the parsed filters, times as ISO strings", async () => {
    asOwner();
    staff.clients.history.listOrders.mockResolvedValue({ orders: [ORDER], total: 1, page: 1, pageSize: 50 });

    const response = await staff.app.inject({ method: "GET", url: "/orders?status=refunded&currency=KHR&from=2026-10-01&to=2026-10-31", headers: staff.headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ orders: [ORDER_JSON], total: 1, page: 1, pageSize: 50 });
    expect(staff.clients.historyFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(staff.clients.history.listOrders).toHaveBeenCalledWith({ status: "refunded", currency: "KHR", from: "2026-10-01", to: "2026-10-31", page: 1 });
  });

  it("answers 400 for a status orders cannot have", async () => {
    asOwner();

    const response = await staff.app.inject({ method: "GET", url: "/orders?status=shipped", headers: staff.headers });

    expect(response.statusCode).toBe(400);
    expect(staff.clients.history.listOrders).not.toHaveBeenCalled();
  });

  it("refuses an instructor", async () => {
    const response = await staff.app.inject({ method: "GET", url: "/orders", headers: staff.headers });

    expect(response.statusCode).toBe(403);
  });
});

describe("GET /orders/:id", () => {
  it("returns one of the school's orders", async () => {
    asOwner();
    staff.clients.history.getOrder.mockResolvedValue(ORDER);

    const response = await staff.app.inject({ method: "GET", url: `/orders/${ORDER_ID}`, headers: staff.headers });

    expect(response.json()).toEqual({ order: ORDER_JSON });
    expect(staff.clients.history.getOrder).toHaveBeenCalledWith(ORDER_ID);
  });

  it("answers 404 for an order the school does not have", async () => {
    asOwner();
    staff.clients.history.getOrder.mockRejectedValue(new OrderNotFoundError());

    const response = await staff.app.inject({ method: "GET", url: `/orders/${ORDER_ID}`, headers: staff.headers });

    expect(response.statusCode).toBe(404);
  });
});
