import { createHmac, randomUUID } from "node:crypto";

import type { Currency, PaymentCheck, PaymentGateway, PaymentRequest } from "@reanit/core/commerce";

/** PayWay's Ecommerce Checkout endpoints (developer.payway.com.kh). */
const PURCHASE_PATH = "/api/payment-gateway/v1/payments/purchase";
const CHECK_PATH = "/api/payment-gateway/v1/payments/check-transaction-2";

/** Purchase fields in the order PayWay concatenates them for the hash; fields not sent count as empty. */
const PURCHASE_HASH_FIELDS = [
  "req_time",
  "merchant_id",
  "tran_id",
  "amount",
  "items",
  "shipping",
  "firstname",
  "lastname",
  "email",
  "phone",
  "type",
  "payment_option",
  "return_url",
  "cancel_url",
  "continue_success_url",
  "return_deeplink",
  "currency",
  "custom_fields",
  "return_params",
  "payout",
  "lifetime",
  "additional_params",
  "google_pay_token",
  "skip_success_page",
] as const;

/** PayWay limits `tran_id` to 20 characters. */
const TRAN_ID_LENGTH = 20;
/** `status.code` of a check that found no transaction: the student has not paid yet. */
const NOT_FOUND_CODE = "6";
/** `payment_status_code`s of payments that will not complete. */
const FAILED_CODES = new Set([3, 7]);
const MINOR_PER_MAJOR = 100;

/** How the platform's PayWay merchant profile is reached. */
export interface PayWayConfig {
  merchantId: string;
  /** The API key ABA Bank issued; it signs every request. */
  apiKey: string;
  /** e.g. https://checkout-sandbox.payway.com.kh */
  baseUrl: string;
  /** Where PayWay pushes payment results (our webhook). */
  pushbackUrl: string;
  /** Overridable in tests. */
  now?: () => Date;
  newTranId?: () => string;
  fetch?: typeof fetch;
}

/**
 * Signs fields the way PayWay checks them: HMAC-SHA512 with the API key over the values in order, Base64.
 *
 * @param values The values, already in PayWay's order.
 * @param apiKey The API key.
 * @returns The hash.
 */
function payWayHash(values: readonly string[], apiKey: string): string {
  return createHmac("sha512", apiKey).update(values.join("")).digest("base64");
}

/**
 * Formats a time as PayWay's `req_time`: UTC, YYYYMMDDHHmmss.
 *
 * @param date The time.
 * @returns The formatted time.
 */
function reqTime(date: Date): string {
  return date.toISOString().replace(/\D/g, "").slice(0, 14);
}

/**
 * Converts minor units to the major-unit amount PayWay expects ("49.00" dollars, "20000" riel).
 *
 * @param amount Amount in minor units.
 * @param currency Its currency.
 * @returns The amount PayWay reads.
 */
function payWayAmount(amount: number, currency: Currency): string {
  const major = amount / MINOR_PER_MAJOR;
  return currency === "USD" ? major.toFixed(2) : String(major);
}

/**
 * Encodes a value as PayWay's Base64 fields expect.
 *
 * @param value Text or a JSON-able value.
 * @returns The Base64 text.
 */
function base64(value: unknown): string {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64");
}

/**
 * ABA PayWay (KHQR, ABA Pay and cards on PayWay's hosted checkout) as a `PaymentGateway`.
 * The browser posts a signed form to PayWay; payment is confirmed by asking PayWay (check-transaction),
 * so neither the pushback nor the browser's redirect can enroll on its own.
 *
 * @param config Merchant profile, endpoints and test hooks.
 * @returns The gateway.
 */
export function createPayWayGateway(config: PayWayConfig): PaymentGateway {
  const now = config.now ?? (() => new Date());
  const newTranId = config.newTranId ?? (() => randomUUID().replaceAll("-", "").slice(0, TRAN_ID_LENGTH));
  const send = config.fetch ?? fetch;

  return {
    method: "aba_payway",

    /**
     * Tells whether PayWay charges a currency.
     *
     * @param currency The course's currency.
     * @returns True for USD and KHR.
     */
    supports(currency) {
      return currency === "USD" || currency === "KHR";
    },

    /**
     * Builds the signed form the browser posts to PayWay's checkout.
     *
     * @param request The order to charge.
     * @returns The form, with the transaction id as the reference.
     */
    async startPayment(request: PaymentRequest) {
      const amount = payWayAmount(request.amount, request.currency);
      const fields: Record<string, string> = {
        req_time: reqTime(now()),
        merchant_id: config.merchantId,
        tran_id: newTranId(),
        amount,
        items: base64([{ name: request.description, quantity: 1, price: amount }]),
        email: request.customerEmail,
        type: "purchase",
        return_url: base64(config.pushbackUrl),
        cancel_url: request.cancelUrl,
        continue_success_url: request.successUrl,
        currency: request.currency,
      };
      const hash = payWayHash(
        PURCHASE_HASH_FIELDS.map((name) => fields[name] ?? ""),
        config.apiKey,
      );
      return { kind: "form", action: `${config.baseUrl}${PURCHASE_PATH}`, fields: { ...fields, hash }, providerRef: fields.tran_id ?? "" };
    },

    /**
     * Asks PayWay whether a transaction was paid.
     *
     * @param tranId The transaction id.
     * @returns "paid" only for an APPROVED purchase; "failed" when declined or cancelled; "pending" otherwise.
     * @throws {Error} When PayWay cannot be reached or refuses the request (e.g. a bad hash).
     */
    async checkPayment(tranId: string): Promise<PaymentCheck> {
      const time = reqTime(now());
      const response = await send(`${config.baseUrl}${CHECK_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          req_time: time,
          merchant_id: config.merchantId,
          tran_id: tranId,
          hash: payWayHash([time, config.merchantId, tranId], config.apiKey),
        }),
      });
      if (!response.ok) throw new Error(`PayWay check-transaction answered HTTP ${response.status}`);
      const body = (await response.json()) as {
        status?: { code?: string | number; message?: string };
        data?: { payment_status_code?: number; payment_status?: string };
      };
      const code = String(body.status?.code ?? "");
      if (code === NOT_FOUND_CODE) return "pending";
      if (code !== "00") throw new Error(`PayWay check-transaction failed: ${code} ${body.status?.message ?? ""}`.trim());
      if (body.data?.payment_status_code === 0 && body.data.payment_status === "APPROVED") return "paid";
      return FAILED_CODES.has(body.data?.payment_status_code ?? -1) ? "failed" : "pending";
    },
  };
}
