import { Module } from "@nestjs/common";
import {
  createCommerceService,
  createOrderHistory,
  createPaymentConfirmation,
  createPayoutAdmin,
  createPayouts,
  type PaymentConfirmation,
  type PaymentGateway,
} from "@reanit/core/commerce";
import { createPlanBilling, createPlatformAdmin } from "@reanit/core/schools";
import {
  createCommerceStore,
  createOrderHistoryStore,
  createPaymentConfirmationStore,
  createPayoutAdminStore,
  createPayoutStore,
  createPlanBillingStore,
  createPlanConfirmationStore,
  createPlatformAdminStore,
  type DbClient,
} from "@reanit/db";
import { DB_CLIENT, ENV } from "@reanit/nest";
import Stripe from "stripe";

import type { Env } from "../config/env";
import { systemClock } from "../context/clock";
import { SchoolsModule } from "../schools/schools.module";
import { PLAN_GUARD_FOR, type PlanGuardFor } from "../schools/schools.tokens";
import { AdminPayoutsController } from "./admin-payouts.controller";
import { AdminPlanPaymentsController } from "./admin-plan-payments.controller";
import { AdminSchoolsController } from "./admin-schools.controller";
import { BundlesController } from "./bundles.controller";
import { CheckoutController } from "./checkout.controller";
import { CouponsController } from "./coupons.controller";
import { createBakongGateway } from "./bakong-gateway";
import { createFakeGateway } from "./fake-gateway";
import {
  BAKONG,
  CARD,
  COMMERCE_FOR_SCHOOL,
  ORDER_HISTORY_FOR_SCHOOL,
  PAYMENT_CONFIRMATION,
  PAYMENT_GATEWAYS,
  PAYOUT_ADMIN,
  PLATFORM_ADMIN,
  PAYOUTS_FOR_SCHOOL,
  PAYWAY,
  PLAN_BILLING_FOR_SCHOOL,
  STRIPE,
  type CommerceForSchool,
  type OrderHistoryForSchool,
  type PayoutsForSchool,
  type PlanBillingForSchool,
} from "./commerce.tokens";
import { createPayWayGateway } from "./payway-gateway";
import { PayoutsController } from "./payouts.controller";
import { PayWayWebhookController } from "./payway-webhook.controller";
import { PlanController } from "./plan.controller";
import { OrdersController } from "./orders.controller";
import { PriceController } from "./price.controller";
import { PurchasesController } from "./purchases.controller";
import { createStripeGateway } from "./stripe-gateway";
import { StripeWebhookController } from "./stripe-webhook.controller";

/**
 * Connects to Stripe when it is configured.
 *
 * @param env Validated environment.
 * @returns The client, or null without credentials.
 */
function provideStripe(env: Env): Stripe | null {
  return env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
}

/**
 * Connects to ABA PayWay when it is configured. Its pushback reaches the API through the web app's `/api` rewrite.
 *
 * @param env Validated environment.
 * @returns The gateway, or null without credentials.
 */
function providePayWay(env: Env): PaymentGateway | null {
  if (!env.PAYWAY_MERCHANT_ID || !env.PAYWAY_API_KEY) return null;
  return createPayWayGateway({
    merchantId: env.PAYWAY_MERCHANT_ID,
    apiKey: env.PAYWAY_API_KEY,
    baseUrl: env.PAYWAY_BASE_URL,
    pushbackUrl: new URL("/api/webhooks/payway", env.APP_URL).href,
  });
}

/**
 * Connects to Bakong when it is configured. Bakong has no webhook: orders are checked when their status is read.
 *
 * @param env Validated environment.
 * @returns The gateway, or null without credentials.
 */
function provideBakong(env: Env): PaymentGateway | null {
  if (!env.BAKONG_ACCOUNT_ID || !env.BAKONG_TOKEN) return null;
  return createBakongGateway({
    accountId: env.BAKONG_ACCOUNT_ID,
    merchantName: env.BAKONG_MERCHANT_NAME,
    merchantCity: env.BAKONG_MERCHANT_CITY,
    token: env.BAKONG_TOKEN,
    baseUrl: env.BAKONG_BASE_URL,
  });
}

/**
 * Picks the card gateway: Stripe when it is configured, the fake under `FAKE_PAYMENTS` (end-to-end tests).
 *
 * @param env Validated environment; it never sets both.
 * @param stripe Stripe client, or null.
 * @returns The gateway, or null when neither is set.
 */
function provideCardGateway(env: Env, stripe: Stripe | null): PaymentGateway | null {
  if (env.FAKE_PAYMENTS) return createFakeGateway();
  return stripe && createStripeGateway(stripe);
}

/**
 * Lists the gateways that are configured, in the order checkout offers them: local methods first.
 *
 * @param payway The PayWay gateway, or null.
 * @param bakong The Bakong KHQR gateway, or null.
 * @param card The card gateway, or null.
 * @returns The gateways.
 */
function provideGateways(payway: PaymentGateway | null, bakong: PaymentGateway | null, card: PaymentGateway | null): PaymentGateway[] {
  return [payway, bakong, card].filter((gateway): gateway is PaymentGateway => gateway !== null);
}

/**
 * Wires per-school commerce services to Postgres (tenant client), the gateways, the confirmation and the school's plan.
 *
 * @param db The shared database client.
 * @param gateways The configured gateways.
 * @param confirmation Enrolls from confirmed payments.
 * @param planFor Builds a school's plan guard, for the platform's fee and the offline QR.
 * @returns A factory of commerce services limited to one school.
 */
function provideCommerceForSchool(db: DbClient, gateways: PaymentGateway[], confirmation: PaymentConfirmation, planFor: PlanGuardFor): CommerceForSchool {
  return (schoolId) => createCommerceService({ store: createCommerceStore(db, schoolId), gateways, confirmation, clock: systemClock, plan: planFor(schoolId) });
}

/**
 * Wires per-school plan billing to Postgres (tenant client), the gateways and the confirmation.
 *
 * @param db The shared database client.
 * @param gateways The configured gateways.
 * @param confirmation Confirms gateway payments, plan payments included.
 * @param env Validated environment, for the platform's payment QR.
 * @returns A factory of plan billings limited to one school.
 */
function providePlanBillingForSchool(db: DbClient, gateways: PaymentGateway[], confirmation: PaymentConfirmation, env: Env): PlanBillingForSchool {
  const platformQrUrl = env.PLATFORM_PAYMENT_QR_URL ?? null;
  return (schoolId) => createPlanBilling({ store: createPlanBillingStore(db, schoolId), gateways, platformQrUrl, confirmPlanPayment: confirmation.confirm, clock: systemClock });
}

/**
 * Wires per-school order history to Postgres through the tenant client.
 *
 * @param db The shared database client.
 * @returns A factory of order histories limited to one school.
 */
function provideOrderHistoryForSchool(db: DbClient): OrderHistoryForSchool {
  return (schoolId) => createOrderHistory(createOrderHistoryStore(db, schoolId));
}

/**
 * Wires per-school payouts to Postgres through the tenant client and the clock.
 *
 * @param db The shared database client.
 * @returns A factory of payouts limited to one school.
 */
function providePayoutsForSchool(db: DbClient): PayoutsForSchool {
  return (schoolId) => createPayouts({ store: createPayoutStore(db, schoolId), clock: systemClock });
}

/**
 * Wires the platform admins' payouts to Postgres across schools and the clock.
 *
 * @param db The shared database client.
 * @returns The admins' payout use cases.
 */
function providePayoutAdmin(db: DbClient) {
  return createPayoutAdmin({ store: createPayoutAdminStore(db), clock: systemClock });
}

/**
 * Builds the platform admins' school and plan payment use cases.
 *
 * @param db Unscoped client.
 * @param confirmation The payment confirmation, which confirms plan payments to the platform's QR.
 * @returns The use cases.
 */
function providePlatformAdmin(db: DbClient, confirmation: PaymentConfirmation) {
  return createPlatformAdmin({ store: createPlatformAdminStore(db), confirmOfflinePlan: confirmation.confirmOfflinePlan, clock: systemClock });
}

/**
 * Wires the confirmation use case that enrolls from confirmed payments and moves plans on from creators' plan payments.
 *
 * @param db The shared database client.
 * @returns The confirmation use case.
 */
function provideConfirmation(db: DbClient) {
  return createPaymentConfirmation({ store: createPaymentConfirmationStore(db), plans: createPlanConfirmationStore(db), clock: systemClock });
}

/** Prices, coupons, bundles, subscriptions and payment plans, checkout with the configured gateways and offline QR, order history, refunds, creators' plan billing and payouts, and the webhooks that confirm payments. */
@Module({
  imports: [SchoolsModule],
  controllers: [
    PriceController,
    CouponsController,
    BundlesController,
    CheckoutController,
    PurchasesController,
    OrdersController,
    PlanController,
    PayoutsController,
    AdminPayoutsController,
    AdminSchoolsController,
    AdminPlanPaymentsController,
    StripeWebhookController,
    PayWayWebhookController,
  ],
  providers: [
    { provide: STRIPE, inject: [ENV], useFactory: provideStripe },
    { provide: PAYWAY, inject: [ENV], useFactory: providePayWay },
    { provide: BAKONG, inject: [ENV], useFactory: provideBakong },
    { provide: CARD, inject: [ENV, STRIPE], useFactory: provideCardGateway },
    { provide: PAYMENT_GATEWAYS, inject: [PAYWAY, BAKONG, CARD], useFactory: provideGateways },
    { provide: COMMERCE_FOR_SCHOOL, inject: [DB_CLIENT, PAYMENT_GATEWAYS, PAYMENT_CONFIRMATION, PLAN_GUARD_FOR], useFactory: provideCommerceForSchool },
    { provide: PAYOUTS_FOR_SCHOOL, inject: [DB_CLIENT], useFactory: providePayoutsForSchool },
    { provide: PAYOUT_ADMIN, inject: [DB_CLIENT], useFactory: providePayoutAdmin },
    { provide: PLATFORM_ADMIN, inject: [DB_CLIENT, PAYMENT_CONFIRMATION], useFactory: providePlatformAdmin },
    { provide: PLAN_BILLING_FOR_SCHOOL, inject: [DB_CLIENT, PAYMENT_GATEWAYS, PAYMENT_CONFIRMATION, ENV], useFactory: providePlanBillingForSchool },
    { provide: PAYMENT_CONFIRMATION, inject: [DB_CLIENT], useFactory: provideConfirmation },
    { provide: ORDER_HISTORY_FOR_SCHOOL, inject: [DB_CLIENT], useFactory: provideOrderHistoryForSchool },
  ],
})
export class CommerceModule {}
