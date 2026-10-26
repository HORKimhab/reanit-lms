import { describe, expect, it } from "vitest";

import { FakeOrderHistoryStore } from "../test/commerce-fakes";
import { OrderNotFoundError } from "./errors";
import { createOrderHistory, orderListQuerySchema, orderReference, ORDERS_PAGE_SIZE } from "./orders";
import type { OrderDetail } from "./ports";

const ORDER: OrderDetail = {
  id: "order-1",
  status: "paid",
  method: "stripe",
  total: { amount: 4900, currency: "USD" },
  items: [{ courseId: "c1", title: "Brand", amount: 4900, currency: "USD" }],
  bundleTitle: null,
  couponCode: null,
  buyer: { id: "user-1", name: "Sokha", email: "sokha@example.com" },
  createdAt: new Date("2026-10-20T08:00:00Z"),
  paidAt: new Date("2026-10-20T08:01:00Z"),
  refundedAt: null,
  isRefundedByHand: false,
  paymentReference: null,
};

describe("listMyOrders", () => {
  it("lists only the student's own orders, one page at a time", async () => {
    const store = new FakeOrderHistoryStore();
    store.orders = [ORDER];
    store.total = 51;

    expect(await createOrderHistory(store).listMyOrders("user-1", { page: 2 })).toEqual({ orders: [ORDER], total: 51, page: 2, pageSize: ORDERS_PAGE_SIZE });
    expect(store.lastQuery).toEqual({ filter: { userId: "user-1" }, window: { limit: ORDERS_PAGE_SIZE, offset: ORDERS_PAGE_SIZE } });
  });
});

describe("listOrders", () => {
  it("filters by status, course and currency, and by the days the order was placed, the last day included", async () => {
    const store = new FakeOrderHistoryStore();
    const query = orderListQuerySchema.parse({ status: "refunded", courseId: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01", currency: "KHR", from: "2026-10-01", to: "2026-10-31" });

    await createOrderHistory(store).listOrders(query);

    expect(store.lastQuery).toEqual({
      filter: {
        status: "refunded",
        courseId: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01",
        currency: "KHR",
        placedFrom: new Date("2026-10-01T00:00:00Z"),
        placedBefore: new Date("2026-11-01T00:00:00Z"),
      },
      window: { limit: ORDERS_PAGE_SIZE, offset: 0 },
    });
  });

  it("lists every order without filters", async () => {
    const store = new FakeOrderHistoryStore();

    await createOrderHistory(store).listOrders(orderListQuerySchema.parse({}));

    expect(store.lastQuery?.filter).toEqual({ status: undefined, courseId: undefined, currency: undefined, placedFrom: undefined, placedBefore: undefined });
  });

  it.each([{ status: "shipped" }, { currency: "EUR" }, { from: "2026-13-01" }, { courseId: "c1" }, { page: "0" }])("refuses the query %j", (query) => {
    expect(orderListQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("getOrder", () => {
  it("returns the school's order", async () => {
    const store = new FakeOrderHistoryStore();
    store.orders = [ORDER];

    expect(await createOrderHistory(store).getOrder("order-1")).toEqual(ORDER);
  });

  it("throws OrderNotFoundError for an order the school does not have", async () => {
    await expect(createOrderHistory(new FakeOrderHistoryStore()).getOrder("order-404")).rejects.toThrow(OrderNotFoundError);
  });
});

describe("orderReference", () => {
  it("shows the first eight characters of the id, upper-cased", () => {
    expect(orderReference("6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a40")).toBe("6F1C1F3E");
  });
});
