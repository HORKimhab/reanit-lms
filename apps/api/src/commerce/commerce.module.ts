import { Module } from "@nestjs/common";
import { createCommerceService, createOrderHistory, createPaymentConfirmation, type PaymentConfirmation, type PaymentGateway } from "@reanit/core/commerce";
import { createCommerceStore, createOrderHistoryStore, createPaymentConfirmationStore, type DbClient } from "@reanit/db";
import { DB_CLIENT, ENV } from "@reanit/nest";
import Stripe from "stripe";

import type { Env } from "../config/env";
import { systemClock } from "../context/clock";
import { SchoolsModule } from "../schools/schools.module";
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
  PAYWAY,
  STRIPE,
  type CommerceForSchool,
  type OrderHistoryForSchool,
} from "./commerce.tokens";
import { createPayWayGateway } from "./payway-gateway";
import { PayWayWebhookController } from "./payway-webhook.controller";
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
 * Wires per-school commerce services to Postgres (tenant client), the gateways and the confirmation.
 *
 * @param db The shared database client.
 * @param gateways The configured gateways.
 * @param confirmation Enrolls from confirmed payments.
 * @returns A factory of commerce services limited to one school.
 */
function provideCommerceForSchool(db: DbClient, gateways: PaymentGateway[], confirmation: PaymentConfirmation): CommerceForSchool {
  return (schoolId) => createCommerceService({ store: createCommerceStore(db, schoolId), gateways, confirmation, clock: systemClock });
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
 * Wires the confirmation use case that enrolls from confirmed payments.
 *
 * @param db The shared database client.
 * @returns The confirmation use case.
 */
function provideConfirmation(db: DbClient) {
  return createPaymentConfirmation(createPaymentConfirmationStore(db));
}

/** Prices, coupons, bundles, checkout with the configured gateways, order history, refunds, and the webhooks that enroll on payment. */
@Module({
  imports: [SchoolsModule],
  controllers: [PriceController, CouponsController, BundlesController, CheckoutController, PurchasesController, OrdersController, StripeWebhookController, PayWayWebhookController],
  providers: [
    { provide: STRIPE, inject: [ENV], useFactory: provideStripe },
    { provide: PAYWAY, inject: [ENV], useFactory: providePayWay },
    { provide: BAKONG, inject: [ENV], useFactory: provideBakong },
    { provide: CARD, inject: [ENV, STRIPE], useFactory: provideCardGateway },
    { provide: PAYMENT_GATEWAYS, inject: [PAYWAY, BAKONG, CARD], useFactory: provideGateways },
    { provide: COMMERCE_FOR_SCHOOL, inject: [DB_CLIENT, PAYMENT_GATEWAYS, PAYMENT_CONFIRMATION], useFactory: provideCommerceForSchool },
    { provide: PAYMENT_CONFIRMATION, inject: [DB_CLIENT], useFactory: provideConfirmation },
    { provide: ORDER_HISTORY_FOR_SCHOOL, inject: [DB_CLIENT], useFactory: provideOrderHistoryForSchool },
  ],
})
export class CommerceModule {}
