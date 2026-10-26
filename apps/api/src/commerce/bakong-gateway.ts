import { PAYMENT_WINDOWS_MS, type Currency, type PaymentCheck, type PaymentGateway, type PaymentRequest } from "@reanit/core/commerce";
import khqr from "bakong-khqr";

/** Bakong Open API endpoint that looks a transaction up by the MD5 of the KHQR code it paid (api-bakong.nbc.gov.kh). */
const CHECK_PATH = "/v1/check_transaction_by_md5";
/** How long a code can be scanned before banking apps refuse it; the order expiry sweep uses the same window. */
const KHQR_LIFETIME_MS = PAYMENT_WINDOWS_MS.bakong_khqr;
/** `responseCode` of a successful lookup. */
const FOUND_CODE = 0;
/** `errorCode` of a lookup that found nothing: the student has not paid yet. */
const NOT_FOUND_ERROR = 1;
/** `errorCode` of a transaction that failed. */
const FAILED_ERROR = 3;
/** `status.code` of the library's successful result. */
const LIBRARY_SUCCESS = 0;
const MINOR_PER_MAJOR = 100;

/** The ISO 4217 numeric codes KHQR carries. */
const KHQR_CURRENCIES: Record<Currency, number> = { USD: khqr.khqrData.currency.usd, KHR: khqr.khqrData.currency.khr };

/** How the platform's Bakong account is reached. */
export interface BakongConfig {
  /** The account paid, e.g. `reanit@aclb`. */
  accountId: string;
  /** Payee name banking apps show (at most 25 characters). */
  merchantName: string;
  /** Payee city banking apps show (at most 15 characters). */
  merchantCity: string;
  /** Open API token from api-bakong.nbc.gov.kh; it expires every 90 days. */
  token: string;
  /** e.g. https://api-bakong.nbc.gov.kh */
  baseUrl: string;
  /** Overridable in tests. */
  fetch?: typeof fetch;
}

/**
 * Bakong KHQR as a `PaymentGateway`: a dynamic KHQR code per order, made with the official library.
 * Bakong has no webhook, so payment is confirmed by asking Bakong for the transaction that paid the
 * code, looked up by the code's MD5 (the reference).
 *
 * @param config Account, payee details, Open API token and test hooks.
 * @returns The gateway.
 */
export function createBakongGateway(config: BakongConfig): PaymentGateway {
  const send = config.fetch ?? fetch;

  return {
    method: "bakong_khqr",

    /**
     * Tells whether KHQR carries a currency.
     *
     * @param currency The course's currency.
     * @returns True for USD and KHR.
     */
    supports(currency) {
      return currency in KHQR_CURRENCIES;
    },

    /**
     * Makes the order's KHQR code, valid for `KHQR_LIFETIME_MS`.
     *
     * @param request The order to charge.
     * @returns The code to show, with its MD5 as the reference.
     * @throws {Error} When the library refuses the payee details or the amount.
     */
    async startPayment(request: PaymentRequest) {
      const expiresAt = new Date(Date.now() + KHQR_LIFETIME_MS);
      const info = new khqr.IndividualInfo(config.accountId, config.merchantName, config.merchantCity, {
        currency: KHQR_CURRENCIES[request.currency],
        amount: request.amount / MINOR_PER_MAJOR,
        expirationTimestamp: expiresAt.getTime(),
      });
      const { status, data } = new khqr.BakongKHQR().generateIndividual(info);
      if (status.code !== LIBRARY_SUCCESS || !data) throw new Error(`Bakong KHQR was not generated: ${status.message ?? "no data"}`);
      return { kind: "qr", qr: data.qr, providerRef: data.md5, expiresAt };
    },

    /**
     * Asks Bakong whether a code was paid.
     *
     * @param md5 The MD5 of the order's KHQR code.
     * @returns "paid" when Bakong has the transaction; "failed" when it failed; "pending" while none exists.
     * @throws {Error} When Bakong cannot be reached or refuses the request (e.g. an expired token).
     */
    async checkPayment(md5: string): Promise<PaymentCheck> {
      const response = await send(`${config.baseUrl}${CHECK_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${config.token}` },
        body: JSON.stringify({ md5 }),
      });
      if (!response.ok) throw new Error(`Bakong check_transaction_by_md5 answered HTTP ${response.status}`);
      const body = (await response.json()) as { responseCode?: number; responseMessage?: string; errorCode?: number | null };
      if (body.responseCode === FOUND_CODE) return "paid";
      if (body.errorCode === NOT_FOUND_ERROR) return "pending";
      if (body.errorCode === FAILED_ERROR) return "failed";
      throw new Error(`Bakong check_transaction_by_md5 failed: ${body.errorCode ?? ""} ${body.responseMessage ?? ""}`.trim());
    },
  };
}
