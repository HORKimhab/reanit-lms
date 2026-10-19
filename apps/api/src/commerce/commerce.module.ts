import { Module } from "@nestjs/common";
import { createCommerceService, createPaymentConfirmation, type PaymentConfirmation, type PaymentGateway } from "@reanit/core/commerce";
import { createCommerceStore, createPaymentConfirmationStore, type DbClient } from "@reanit/db";
import { DB_CLIENT, ENV } from "@reanit/nest";
import Stripe from "stripe";

import type { Env } from "../config/env";
import { SchoolsModule } from "../schools/schools.module";
import { CheckoutController } from "./checkout.controller";
import { COMMERCE_FOR_SCHOOL, PAYMENT_CONFIRMATION, PAYMENT_GATEWAYS, PAYWAY, STRIPE, type CommerceForSchool } from "./commerce.tokens";
import { createPayWayGateway } from "./payway-gateway";
import { PayWayWebhookController } from "./payway-webhook.controller";
import { PriceController } from "./price.controller";
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
 * Lists the gateways that are configured, in the order checkout offers them: local methods first.
 *
 * @param payway The PayWay gateway, or null.
 * @param stripe Stripe client, or null.
 * @returns The gateways.
 */
function provideGateways(payway: PaymentGateway | null, stripe: Stripe | null): PaymentGateway[] {
  return [payway, stripe && createStripeGateway(stripe)].filter((gateway): gateway is PaymentGateway => gateway !== null);
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
  return (schoolId) => createCommerceService({ store: createCommerceStore(db, schoolId), gateways, confirmation });
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

/** Prices, checkout with the configured gateways, and the webhooks that enroll on payment. */
@Module({
  imports: [SchoolsModule],
  controllers: [PriceController, CheckoutController, StripeWebhookController, PayWayWebhookController],
  providers: [
    { provide: STRIPE, inject: [ENV], useFactory: provideStripe },
    { provide: PAYWAY, inject: [ENV], useFactory: providePayWay },
    { provide: PAYMENT_GATEWAYS, inject: [PAYWAY, STRIPE], useFactory: provideGateways },
    { provide: COMMERCE_FOR_SCHOOL, inject: [DB_CLIENT, PAYMENT_GATEWAYS, PAYMENT_CONFIRMATION], useFactory: provideCommerceForSchool },
    { provide: PAYMENT_CONFIRMATION, inject: [DB_CLIENT], useFactory: provideConfirmation },
  ],
})
export class CommerceModule {}
