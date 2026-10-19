import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { createPayWayGateway, type PayWayConfig } from "./payway-gateway";

const NOW = new Date("2026-10-19T01:02:03Z");
/** The profile and endpoints, without the test hooks. */
const PROFILE = {
  merchantId: "ec000002",
  apiKey: "test-api-key",
  baseUrl: "https://checkout-sandbox.payway.test",
  pushbackUrl: "http://localhost:3000/api/webhooks/payway",
};

/**
 * The test's fixed time.
 *
 * @returns `NOW`.
 */
function now() {
  return NOW;
}

/**
 * The test's fixed transaction id.
 *
 * @returns A 20-character id.
 */
function newTranId() {
  return "a1b2c3d4e5f6a7b8c9d0";
}

const CONFIG: PayWayConfig = { ...PROFILE, now, newTranId };
const REQUEST = {
  orderId: "order-1",
  amount: 4900,
  currency: "USD" as const,
  description: "Brand Design Basics",
  customerEmail: "dara@example.com",
  successUrl: "http://localhost:3000/s/angkor/orders/order-1",
  cancelUrl: "http://localhost:3000/s/angkor/courses/brand",
};

/**
 * Signs text the way PayWay documents it: HMAC-SHA512 with the API key, Base64.
 *
 * @param text The concatenated values.
 * @returns The hash.
 */
function sign(text: string) {
  return createHmac("sha512", CONFIG.apiKey).update(text).digest("base64");
}

/**
 * Creates a fetch that answers PayWay's check-transaction with the given body.
 *
 * @param body The JSON body.
 * @param status The HTTP status.
 * @returns The fake.
 */
function payWayAnswering(body: object, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }));
}

describe("createPayWayGateway startPayment", () => {
  it("builds the checkout form, signed over the documented field order", async () => {
    const start = await createPayWayGateway(CONFIG).startPayment(REQUEST);
    if (start.kind !== "form") throw new Error("expected a form");
    const { fields } = start;
    const items = Buffer.from(JSON.stringify([{ name: "Brand Design Basics", quantity: 1, price: "49.00" }])).toString("base64");
    const returnUrl = Buffer.from(CONFIG.pushbackUrl).toString("base64");

    expect(start.action).toBe("https://checkout-sandbox.payway.test/api/payment-gateway/v1/payments/purchase");
    expect(start.providerRef).toBe("a1b2c3d4e5f6a7b8c9d0");
    expect(fields).toMatchObject({
      req_time: "20261019010203",
      merchant_id: "ec000002",
      tran_id: "a1b2c3d4e5f6a7b8c9d0",
      amount: "49.00",
      items,
      email: "dara@example.com",
      type: "purchase",
      return_url: returnUrl,
      cancel_url: REQUEST.cancelUrl,
      continue_success_url: REQUEST.successUrl,
      currency: "USD",
    });
    // req_time, merchant_id, tran_id, amount, items, [shipping, firstname, lastname], email, [phone], type,
    // [payment_option], return_url, cancel_url, continue_success_url, [return_deeplink], currency, ...
    const expected = ["20261019010203", "ec000002", "a1b2c3d4e5f6a7b8c9d0", "49.00", items, "dara@example.com", "purchase", returnUrl, REQUEST.cancelUrl, REQUEST.successUrl, "USD"].join("");
    expect(fields.hash).toBe(sign(expected));
  });

  it("sends riel as whole riel", async () => {
    const start = await createPayWayGateway(CONFIG).startPayment({ ...REQUEST, amount: 2_000_000, currency: "KHR" });

    expect(start.kind === "form" && start.fields.amount).toBe("20000");
  });

  it("makes transaction ids that fit PayWay's 20 characters", async () => {
    const start = await createPayWayGateway(PROFILE).startPayment(REQUEST);

    expect(start.providerRef).toMatch(/^[0-9a-f]{20}$/);
  });

  it("takes USD and KHR", () => {
    const gateway = createPayWayGateway(CONFIG);

    expect([gateway.supports("USD"), gateway.supports("KHR")]).toEqual([true, true]);
  });
});

describe("createPayWayGateway checkPayment", () => {
  it("asks check-transaction with a signed request and reports an approved purchase as paid", async () => {
    const fetch = payWayAnswering({ data: { payment_status_code: 0, payment_status: "APPROVED" }, status: { code: "00", message: "Success!" } });

    const result = await createPayWayGateway({ ...CONFIG, fetch }).checkPayment?.("tran-1");

    expect(result).toBe("paid");
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://checkout-sandbox.payway.test/api/payment-gateway/v1/payments/check-transaction-2");
    expect(JSON.parse(String(init?.body))).toEqual({
      req_time: "20261019010203",
      merchant_id: "ec000002",
      tran_id: "tran-1",
      hash: sign("20261019010203ec000002tran-1"),
    });
  });

  it.each([
    ["pending", { data: { payment_status_code: 2, payment_status: "PENDING" }, status: { code: "00" } }, "pending"],
    ["held, not captured", { data: { payment_status_code: 0, payment_status: "PRE-AUTH" }, status: { code: "00" } }, "pending"],
    ["not started yet", { status: { code: 6, message: "Transaction not found" } }, "pending"],
    ["declined", { data: { payment_status_code: 3, payment_status: "DECLINED" }, status: { code: "00" } }, "failed"],
    ["cancelled", { data: { payment_status_code: 7, payment_status: "CANCELLED" }, status: { code: "00" } }, "failed"],
  ])("reports a %s transaction as %s", async (_case, body, expected) => {
    expect(await createPayWayGateway({ ...CONFIG, fetch: payWayAnswering(body) }).checkPayment?.("tran-1")).toBe(expected);
  });

  it("throws when PayWay refuses the request", async () => {
    const gateway = createPayWayGateway({ ...CONFIG, fetch: payWayAnswering({ status: { code: "5", message: "Invalid hash" } }) });

    await expect(gateway.checkPayment?.("tran-1")).rejects.toThrow("Invalid hash");
  });

  it("throws when PayWay cannot be reached", async () => {
    const gateway = createPayWayGateway({ ...CONFIG, fetch: payWayAnswering({}, 503) });

    await expect(gateway.checkPayment?.("tran-1")).rejects.toThrow("HTTP 503");
  });
});
