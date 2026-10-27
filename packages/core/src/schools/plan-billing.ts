import { z } from "zod";

import type { Clock } from "../auth";
import { EMAIL_LOCALES } from "../notifications/rules";
import {
  BILLING_INTERVALS,
  ONE_TIME_ONLY_METHODS,
  PAYMENT_METHODS,
  type BillingInterval,
  type OfflinePaymentInput,
  type PaymentMethod,
} from "../commerce/rules";
import type { GatewayPaymentStart, PaymentCheck, PaymentGateway } from "../commerce/ports";
import type { RenewSubscription } from "../commerce/subscriptions";
import { PlanPaymentClosedError, PlanPaymentNotFoundError, PlanPaymentMethodUnavailableError } from "./errors";
import { currentPlan, PAID_PLANS, PLAN_CURRENCY, PLAN_TERMS, type CreatorPlan, type PaidPlan, type PlanTerms, type StoredPlan } from "./plans";

/** `POST /schools/current/plan/checkout` body: the plan, its period, how the creator pays, and the receipt's language. */
export const planCheckoutSchema = z.object({
  plan: z.enum(PAID_PLANS),
  interval: z.enum(BILLING_INTERVALS),
  method: z.enum(PAYMENT_METHODS),
  locale: z.enum(EMAIL_LOCALES).default("en"),
});

/** Parsed plan checkout input. */
export type PlanCheckoutInput = z.infer<typeof planCheckoutSchema>;

/** Where a creator's payment for a plan stands. */
export type PlanPaymentStatus = "pending" | "paid" | "failed";

/** A creator's payment to the platform for one period of a plan. */
export interface PlanPayment {
  id: string;
  plan: PaidPlan;
  interval: BillingInterval;
  /** USD cents. */
  amount: number;
  method: PaymentMethod;
  status: PlanPaymentStatus;
  /** The gateway's reference; null until payment starts. Never sent to the browser. */
  providerRef: string | null;
  /** For a payment to the platform's QR: the reference the creator's banking app showed, once they say they paid. */
  reference: string | null;
}

/** What the browser does next to pay for a plan: a gateway's step, or showing the platform's payment QR, after which the creator says they paid and a platform admin confirms it. */
export type PlanPaymentStart = GatewayPaymentStart | { kind: "offline"; qrImageUrl: string };

/** How a confirmation finds a plan payment: a gateway's reference, or the id of a payment to the platform's QR a platform admin checked. */
export type PlanPaymentMatch = { method: PaymentGateway["method"]; providerRef: string } | { offlinePaymentId: string };

/** One school's plan and its payments to the platform. `@reanit/db` implements it with `createPlanBillingStore`. */
export interface PlanBillingStore {
  findPlan(): Promise<StoredPlan>;
  createPlanPayment(payment: { plan: PaidPlan; interval: BillingInterval; amount: number; method: PaymentMethod }): Promise<{ id: string }>;
  setProviderRef(paymentId: string, providerRef: string): Promise<void>;
  /** The school's payment, or null when it has no such payment. */
  findPlanPayment(paymentId: string): Promise<PlanPayment | null>;
  /** Marks a pending payment failed: its gateway said it will not complete. */
  failPlanPayment(paymentId: string): Promise<void>;
  /** Records the creator's reference on a pending payment to the platform's QR; false when there is no such payment. */
  submitOfflinePayment(paymentId: string, reference: string): Promise<boolean>;
}

/**
 * Marks plan payments paid across schools: by the gateway's reference, or by id for a payment to the
 * platform's QR. `@reanit/db` implements it with `createPlanConfirmationStore`.
 */
export interface PlanConfirmationStore {
  /**
   * Marks the payment paid and moves its school's plan on, in one transaction, once: paying the plan
   * and period the school is on continues from its paid period's end, any other starts at the payment.
   * Returns null when no plan payment matches.
   */
  confirm(payment: PlanPaymentMatch, at: Date, renew: RenewSubscription): Promise<{ paymentId: string; isNewlyPaid: boolean } | null>;
}

/** A school's plan as its owner sees it. */
export interface SchoolPlan {
  /** The plan in force: Free once a paid plan ran out. */
  plan: CreatorPlan;
  terms: PlanTerms;
  /** The plan last paid for, its period and until when; null on Free. */
  paid: { plan: PaidPlan; interval: BillingInterval; periodEnd: Date } | null;
}

/** Where the gateway sends the creator back, given the new payment's id. */
type ReturnUrls = (paymentId: string) => { successUrl: string; cancelUrl: string };

/** The methods a plan can be paid with: the gateways that take dollars and bill period by period. */
type PlanGateways = readonly PaymentGateway[];

/**
 * Builds one school's plan billing: the plan in force, paying the platform for a plan period through
 * a gateway or the platform's own QR, and following that payment until it is confirmed.
 *
 * @param dependencies The school's billing store, the gateways, the platform's QR, the plan confirmation and the clock.
 * @param dependencies.store The school's plan and payments.
 * @param dependencies.gateways Every configured gateway; plans are paid by those that take dollars and are not one-time only.
 * @param dependencies.platformQrUrl The platform's payment QR image, or null when plans cannot be paid by QR transfer.
 * @param dependencies.confirmPlanPayment Marks a gateway's payment paid and moves the plan on.
 * @param dependencies.clock The current time.
 * @returns The plan billing operations.
 * @example
 * const billing = createPlanBilling({ store: createPlanBillingStore(db, schoolId), gateways, platformQrUrl, confirmPlanPayment, clock });
 */
export function createPlanBilling({
  store,
  gateways,
  platformQrUrl,
  confirmPlanPayment,
  clock,
}: {
  store: PlanBillingStore;
  gateways: PlanGateways;
  platformQrUrl: string | null;
  confirmPlanPayment: (method: PaymentGateway["method"], providerRef: string) => Promise<unknown>;
  clock: Clock;
}) {
  /**
   * Lists the gateways a plan can be paid with.
   *
   * @returns Those that take dollars and bill period by period.
   */
  function planGateways(): PaymentGateway[] {
    return gateways.filter((gateway) => gateway.supports(PLAN_CURRENCY) && !ONE_TIME_ONLY_METHODS.includes(gateway.method));
  }

  return {
    /**
     * Reads the school's plan: the one in force, its terms, and what was last paid for.
     *
     * @returns The plan.
     */
    async getPlan(): Promise<SchoolPlan & { methods: PaymentMethod[] }> {
      const stored = await store.findPlan();
      const plan = currentPlan(stored, clock.now());
      const paid = stored.plan !== "free" && stored.interval && stored.periodEnd ? { plan: stored.plan, interval: stored.interval, periodEnd: stored.periodEnd } : null;
      const methods: PaymentMethod[] = planGateways().map(({ method }) => method);
      return { plan, terms: PLAN_TERMS[plan], paid, methods: platformQrUrl ? ["offline_qr", ...methods] : methods };
    },

    /**
     * Starts paying the platform for a period of a plan. Paying the plan and period the school is on
     * extends it; any other starts when the payment is confirmed, with no credit for the period left.
     * Paying by the platform's QR shows its image; the payment then waits for the creator's reference.
     *
     * @param ownerEmail The owner's email, for the gateway's receipt.
     * @param input The plan, its period and the payment method.
     * @param input.plan Pro or Business.
     * @param input.interval A month or a year.
     * @param input.method The gateway, or `offline_qr` for the platform's QR.
     * @param urls Where the gateway sends the owner back.
     * @returns The payment's id and what the browser does next.
     * @throws {PlanPaymentMethodUnavailableError} When the method cannot take a plan payment.
     */
    async checkout(ownerEmail: string, { plan, interval, method }: PlanCheckoutInput, urls: ReturnUrls): Promise<{ paymentId: string; payment: PlanPaymentStart }> {
      const gateway = planGateways().find((candidate) => candidate.method === method);
      const qrImageUrl = method === "offline_qr" ? platformQrUrl : null;
      if (!gateway && !qrImageUrl) throw new PlanPaymentMethodUnavailableError();
      // Paid plans always have prices.
      const amount = PLAN_TERMS[plan].prices![interval];
      const { id: paymentId } = await store.createPlanPayment({ plan, interval, amount, method });
      // Without a gateway, the check above let the method through on the platform's QR.
      if (!gateway) return { paymentId, payment: { kind: "offline", qrImageUrl: qrImageUrl! } };
      const payment = await gateway.startPayment({
        orderId: paymentId,
        amount,
        currency: PLAN_CURRENCY,
        description: `Reanit ${plan} (${interval})`,
        customerEmail: ownerEmail,
        ...urls(paymentId),
      });
      await store.setProviderRef(paymentId, payment.providerRef);
      return { paymentId, payment };
    },

    /**
     * Reads a plan payment, e.g. while the owner waits on it. A pending payment whose gateway can be
     * asked (PayWay, Bakong) is checked with it: confirmed once paid, failed once the gateway says so.
     *
     * @param paymentId The payment.
     * @returns Its status, up to date with the gateway.
     * @throws {PlanPaymentNotFoundError} When the school has no such payment.
     */
    async getPlanPayment(paymentId: string): Promise<PlanPaymentStatus> {
      const payment = await store.findPlanPayment(paymentId);
      if (!payment) throw new PlanPaymentNotFoundError();
      const gateway = gateways.find(({ method }) => method === payment.method);
      if (payment.status !== "pending" || !payment.providerRef || !gateway?.checkPayment) return payment.status;
      const check: PaymentCheck = await gateway.checkPayment(payment.providerRef);
      if (check === "failed") {
        await store.failPlanPayment(paymentId);
        return "failed";
      }
      if (check !== "paid") return "pending";
      await confirmPlanPayment(gateway.method, payment.providerRef);
      return "paid";
    },

    /**
     * Records the creator's word that they paid the platform's QR, with the reference their banking app
     * showed; the payment then waits for a platform admin to confirm the money arrived.
     *
     * @param paymentId The payment.
     * @param input The transaction reference.
     * @param input.reference As the banking app showed it.
     * @throws {PlanPaymentNotFoundError} When the school has no such payment.
     * @throws {PlanPaymentClosedError} When it is not a pending payment to the platform's QR.
     */
    async submitOfflinePayment(paymentId: string, { reference }: OfflinePaymentInput): Promise<void> {
      if (await store.submitOfflinePayment(paymentId, reference)) return;
      if (!(await store.findPlanPayment(paymentId))) throw new PlanPaymentNotFoundError();
      throw new PlanPaymentClosedError();
    },
  };
}

/** One school's plan billing use cases. */
export type PlanBilling = ReturnType<typeof createPlanBilling>;
