// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { formData as form } from "@/test/form";
import { setTestLocale } from "@/test/intl-server";
import { RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { checkPlanPayment, startPlanCheckout, submitPlanTransfer } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const ROUTE = "POST /schools/current/plan/checkout";
const PAYMENT_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a70";
const IDLE = { status: "idle" } as const;
const PRO_MONTHLY = { plan: "pro", interval: "month", method: "aba_payway" };

beforeEach(() => {
  signIn();
});

describe("startPlanCheckout", () => {
  it("pays for the plan in the page's language and returns PayWay's form", async () => {
    setTestLocale("km");
    onApi(ROUTE, Response.json({ paymentId: PAYMENT_ID, payment: { kind: "form", action: "https://payway.test/purchase", fields: { tran_id: "t" } } }, { status: 201 }));

    expect(await startPlanCheckout(IDLE, form(PRO_MONTHLY))).toEqual({ status: "form", action: "https://payway.test/purchase", fields: { tran_id: "t" }, paymentId: PAYMENT_ID });
    expect(await requestTo(ROUTE)?.json()).toEqual({ ...PRO_MONTHLY, locale: "km" });
  });

  it("returns a KHQR code with the payment to wait on", async () => {
    onApi(ROUTE, Response.json({ paymentId: PAYMENT_ID, payment: { kind: "qr", qr: "000201", expiresAt: "2026-10-27T12:15:00.000Z" } }, { status: 201 }));

    expect(await startPlanCheckout(IDLE, form({ ...PRO_MONTHLY, method: "bakong_khqr" }))).toEqual({ status: "qr", qr: "000201", expiresAt: "2026-10-27T12:15:00.000Z", paymentId: PAYMENT_ID });
  });

  it("sends the owner to a gateway that redirects", async () => {
    onApi(ROUTE, Response.json({ paymentId: PAYMENT_ID, payment: { kind: "redirect", url: "https://pay.test/p" } }, { status: 201 }));

    await expect(startPlanCheckout(IDLE, form(PRO_MONTHLY))).rejects.toThrow(new RedirectError("https://pay.test/p"));
  });

  it("refuses the free plan without calling the API, and a method the API refuses", async () => {
    expect(await startPlanCheckout(IDLE, form({ ...PRO_MONTHLY, plan: "free" }))).toEqual({ status: "unavailable" });
    expect(requestTo(ROUTE)).toBeUndefined();
    onApi(ROUTE, problem(400, "urn:reanit:problem:plan-payment-method-unavailable"));

    expect(await startPlanCheckout(IDLE, form({ ...PRO_MONTHLY, method: "stripe" }))).toEqual({ status: "unavailable" });
  });
});

describe("platform QR transfers", () => {
  const TRANSFER_ROUTE = `POST /schools/current/plan/payments/${PAYMENT_ID}/offline-payment`;

  it("shows the platform's QR for a payment by transfer", async () => {
    onApi(ROUTE, Response.json({ paymentId: PAYMENT_ID, payment: { kind: "offline", qrImageUrl: "https://cdn.reanit.test/platform-qr.png" } }, { status: 201 }));

    expect(await startPlanCheckout(IDLE, form({ ...PRO_MONTHLY, method: "offline_qr" }))).toEqual({ status: "offline", qrImageUrl: "https://cdn.reanit.test/platform-qr.png", paymentId: PAYMENT_ID });
  });

  it("sends the trimmed reference, then shows the plan page waiting on the payment", async () => {
    onApi(TRANSFER_ROUTE, new Response(null, { status: 204 }));

    await expect(submitPlanTransfer(PAYMENT_ID, IDLE, form({ reference: " ABA-123 " }))).rejects.toThrow(new RedirectError(`/dashboard/plan?planPayment=${PAYMENT_ID}`));
    expect(await requestTo(TRANSFER_ROUTE)?.json()).toEqual({ reference: "ABA-123" });
  });

  it("needs a reference, and says when the payment no longer waits for a transfer", async () => {
    expect(await submitPlanTransfer(PAYMENT_ID, IDLE, form({ reference: " " }))).toEqual({ status: "invalid" });
    expect(requestTo(TRANSFER_ROUTE)).toBeUndefined();

    onApi(TRANSFER_ROUTE, problem(409, "urn:reanit:problem:plan-payment-closed"));

    expect(await submitPlanTransfer(PAYMENT_ID, IDLE, form({ reference: "ABA-123" }))).toEqual({ status: "closed" });
  });
});

describe("checkPlanPayment", () => {
  it("reads the payment's status", async () => {
    onApi(`GET /schools/current/plan/payments/${PAYMENT_ID}`, Response.json({ status: "pending" }));

    expect(await checkPlanPayment(PAYMENT_ID)).toBe("pending");
  });
});
