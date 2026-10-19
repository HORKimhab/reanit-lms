import type { PaymentCheck, PaymentGateway } from "@reanit/core/commerce";
import { UnknownPaymentError } from "@reanit/core/commerce";
import { describe, expect, it, vi } from "vitest";

import { createFakeClients, createTestApp } from "../test/app";
import { PAYWAY } from "./commerce.tokens";

/**
 * Boots the app with a PayWay gateway whose status check answers as given.
 *
 * @param check What PayWay's check-transaction reports, or null for PayWay not configured.
 * @returns The app, its fakes and the gateway's check spy.
 */
async function bootWithPayWay(check: PaymentCheck | null) {
  const clients = createFakeClients();
  const checkPayment = vi.fn().mockResolvedValue(check);
  const payway: PaymentGateway | null = check && { method: "aba_payway", supports: vi.fn().mockReturnValue(true), startPayment: vi.fn(), checkPayment };
  const app = await createTestApp(clients, { overrides: [{ provide: PAYWAY, useValue: payway }] });
  return { app, clients, checkPayment };
}

describe("POST /webhooks/payway", () => {
  it("confirms a pushed transaction once PayWay reports it paid", async () => {
    const { app, clients, checkPayment } = await bootWithPayWay("paid");

    const response = await app.inject({ method: "POST", url: "/webhooks/payway", payload: { tran_id: "tran-1", status: 0 } });

    expect(response.statusCode).toBe(200);
    expect(checkPayment).toHaveBeenCalledWith("tran-1");
    expect(clients.confirmation.confirm).toHaveBeenCalledWith("aba_payway", "tran-1");
    await app.close();
  });

  it("enrolls nobody when PayWay does not report the transaction paid, whatever the pushback says", async () => {
    const { app, clients } = await bootWithPayWay("pending");

    const response = await app.inject({ method: "POST", url: "/webhooks/payway", payload: { tran_id: "tran-1", status: 0 } });

    expect(response.statusCode).toBe(200);
    expect(clients.confirmation.confirm).not.toHaveBeenCalled();
    await app.close();
  });

  it("answers 400 to a pushback without a transaction id", async () => {
    const { app, checkPayment } = await bootWithPayWay("paid");

    expect((await app.inject({ method: "POST", url: "/webhooks/payway", payload: { status: 0 } })).statusCode).toBe(400);
    expect(checkPayment).not.toHaveBeenCalled();
    await app.close();
  });

  it("answers 400 when PayWay is not configured", async () => {
    const { app } = await bootWithPayWay(null);

    expect((await app.inject({ method: "POST", url: "/webhooks/payway", payload: { tran_id: "tran-1" } })).statusCode).toBe(400);
    await app.close();
  });

  it("acknowledges an approved transaction no order knows", async () => {
    const { app, clients } = await bootWithPayWay("paid");
    clients.confirmation.confirm.mockRejectedValue(new UnknownPaymentError());

    expect((await app.inject({ method: "POST", url: "/webhooks/payway", payload: { tran_id: "tran-x" } })).statusCode).toBe(200);
    await app.close();
  });
});
