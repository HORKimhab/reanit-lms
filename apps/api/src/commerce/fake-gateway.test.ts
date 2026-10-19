import { describe, expect, it } from "vitest";

import { createFakeGateway } from "./fake-gateway";

const REQUEST = {
  orderId: "order-1",
  amount: 2_000_000,
  currency: "KHR" as const,
  description: "Brand Design Basics",
  customerEmail: "dara@example.com",
  successUrl: "http://localhost:3000/s/angkor/orders/order-1",
  cancelUrl: "http://localhost:3000/s/angkor/courses/brand",
};

describe("createFakeGateway", () => {
  it("stands in for card payments in USD and KHR", () => {
    const gateway = createFakeGateway();

    expect(gateway.method).toBe("stripe");
    expect(gateway.supports("USD")).toBe(true);
    expect(gateway.supports("KHR")).toBe(true);
  });

  it("sends the student straight to the order page", async () => {
    expect(await createFakeGateway().startPayment(REQUEST)).toEqual({ kind: "redirect", url: REQUEST.successUrl, providerRef: "fake_order-1" });
  });

  it("reports the payment paid when asked", async () => {
    expect(await createFakeGateway().checkPayment?.("fake_order-1")).toBe("paid");
  });
});
