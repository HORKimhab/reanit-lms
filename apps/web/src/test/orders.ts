// An order as the order history API sends it and as pages receive it, for tests of purchases and the dashboard's orders.
import type { OrderDetail } from "@reanit/core/commerce";

/** A paid order of one USD course with a coupon, as pages receive it. */
export const ORDER: OrderDetail = {
  id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a40",
  status: "paid",
  method: "stripe",
  total: { amount: 3920, currency: "USD" },
  items: [{ courseId: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01", title: "Brand Design Basics", amount: 3920, currency: "USD" }],
  bundleTitle: null,
  couponCode: "SAVE20",
  buyer: { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a02", name: "Sokha Chan", email: "sokha@example.com" },
  createdAt: new Date("2026-10-20T08:00:00Z"),
  paidAt: new Date("2026-10-20T08:01:00Z"),
  refundedAt: null,
  isRefundedByHand: false,
};

/** `ORDER` as the API sends it, with ISO times. */
export const ORDER_JSON = { ...ORDER, createdAt: "2026-10-20T08:00:00.000Z", paidAt: "2026-10-20T08:01:00.000Z", refundedAt: null };
