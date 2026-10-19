import { createHash } from "node:crypto";

import khqr from "bakong-khqr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBakongGateway, type BakongConfig } from "./bakong-gateway";

const NOW = new Date("2026-10-19T01:02:03Z");
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const CONFIG: BakongConfig = {
  accountId: "reanit@aclb",
  merchantName: "Reanit",
  merchantCity: "Phnom Penh",
  token: "test-token",
  baseUrl: "https://sit-api-bakong.test",
};
const REQUEST = {
  orderId: "order-1",
  amount: 4950,
  currency: "USD" as const,
  description: "Brand Design Basics",
  customerEmail: "dara@example.com",
  successUrl: "http://localhost:3000/s/angkor/orders/order-1",
  cancelUrl: "http://localhost:3000/s/angkor/courses/brand",
};

/**
 * Creates a fetch that answers Bakong's check_transaction_by_md5 with the given body.
 *
 * @param body The JSON body.
 * @param status The HTTP status.
 * @returns The fake.
 */
function bakongAnswering(body: object, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }));
}

/**
 * Reads back the fields a banking app sees in a KHQR code.
 *
 * @param qr The code.
 * @returns The decoded fields.
 */
function decode(qr: string) {
  return khqr.BakongKHQR.decode(qr).data;
}

beforeEach(() => {
  // The library stamps codes with Date.now() and refuses expired ones.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createBakongGateway startPayment", () => {
  it("makes a dynamic KHQR code for the order's amount, referenced by its MD5", async () => {
    const start = await createBakongGateway(CONFIG).startPayment(REQUEST);
    if (start.kind !== "qr") throw new Error("expected a qr");

    expect(decode(start.qr)).toMatchObject({
      bakongAccountID: "reanit@aclb",
      merchantName: "Reanit",
      merchantCity: "Phnom Penh",
      transactionCurrency: "840",
      transactionAmount: "49.50",
      expirationTimestamp: String(NOW.getTime() + FIFTEEN_MINUTES_MS),
    });
    expect(start.providerRef).toBe(createHash("md5").update(start.qr).digest("hex"));
    expect(start.expiresAt).toEqual(new Date(NOW.getTime() + FIFTEEN_MINUTES_MS));
  });

  it("charges riel as whole riel", async () => {
    const start = await createBakongGateway(CONFIG).startPayment({ ...REQUEST, amount: 2_000_000, currency: "KHR" });

    expect(start.kind === "qr" && decode(start.qr)).toMatchObject({ transactionCurrency: "116", transactionAmount: "20000" });
  });

  it("throws when the library refuses the payee", async () => {
    await expect(createBakongGateway({ ...CONFIG, accountId: "no-bank" }).startPayment(REQUEST)).rejects.toThrow("Bakong Account ID is invalid");
  });

  it("takes USD and KHR", () => {
    const gateway = createBakongGateway(CONFIG);

    expect([gateway.supports("USD"), gateway.supports("KHR")]).toEqual([true, true]);
  });
});

describe("createBakongGateway checkPayment", () => {
  it("looks the code up by MD5 with the token and reports a found transaction as paid", async () => {
    const fetch = bakongAnswering({ responseCode: 0, responseMessage: "Getting transaction successfully.", errorCode: null, data: { hash: "abc" } });

    const result = await createBakongGateway({ ...CONFIG, fetch }).checkPayment?.("md5-1");

    expect(result).toBe("paid");
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://sit-api-bakong.test/v1/check_transaction_by_md5");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-token");
    expect(JSON.parse(String(init?.body))).toEqual({ md5: "md5-1" });
  });

  it.each([
    ["not paid yet", { responseCode: 1, responseMessage: "Transaction could not be found. Please check and try again.", errorCode: 1, data: null }, "pending"],
    ["failed", { responseCode: 1, responseMessage: "Transaction failed.", errorCode: 3, data: null }, "failed"],
  ])("reports a %s code as %s", async (_case, body, expected) => {
    expect(await createBakongGateway({ ...CONFIG, fetch: bakongAnswering(body) }).checkPayment?.("md5-1")).toBe(expected);
  });

  it("throws when Bakong refuses the request", async () => {
    const gateway = createBakongGateway({ ...CONFIG, fetch: bakongAnswering({ responseCode: 1, responseMessage: "Unauthorized", errorCode: 6, data: null }) });

    await expect(gateway.checkPayment?.("md5-1")).rejects.toThrow("6 Unauthorized");
  });

  it("throws when Bakong cannot be reached", async () => {
    const gateway = createBakongGateway({ ...CONFIG, fetch: bakongAnswering({}, 401) });

    await expect(gateway.checkPayment?.("md5-1")).rejects.toThrow("HTTP 401");
  });
});
