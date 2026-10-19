import { Module } from "@nestjs/common";
import { createCommerceService, createPaymentConfirmation, type PaymentGateway } from "@reanit/core/commerce";
import { createCommerceStore, createPaymentConfirmationStore, type DbClient } from "@reanit/db";
import { DB_CLIENT, ENV } from "@reanit/nest";
import Stripe from "stripe";

import type { Env } from "../config/env";
import { SchoolsModule } from "../schools/schools.module";
import { CheckoutController } from "./checkout.controller";
import { COMMERCE_FOR_SCHOOL, PAYMENT_CONFIRMATION, PAYMENT_GATEWAYS, STRIPE, type CommerceForSchool } from "./commerce.tokens";
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
 * Lists the gateways that are configured, in the order checkout offers them.
 *
 * @param stripe Stripe client, or null.
 * @returns The gateways.
 */
function provideGateways(stripe: Stripe | null): PaymentGateway[] {
  return stripe ? [createStripeGateway(stripe)] : [];
}

/**
 * Wires per-school commerce services to Postgres (tenant client) and the gateways.
 *
 * @param db The shared database client.
 * @param gateways The configured gateways.
 * @returns A factory of commerce services limited to one school.
 */
function provideCommerceForSchool(db: DbClient, gateways: PaymentGateway[]): CommerceForSchool {
  return (schoolId) => createCommerceService({ store: createCommerceStore(db, schoolId), gateways });
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
  controllers: [PriceController, CheckoutController, StripeWebhookController],
  providers: [
    { provide: STRIPE, inject: [ENV], useFactory: provideStripe },
    { provide: PAYMENT_GATEWAYS, inject: [STRIPE], useFactory: provideGateways },
    { provide: COMMERCE_FOR_SCHOOL, inject: [DB_CLIENT, PAYMENT_GATEWAYS], useFactory: provideCommerceForSchool },
    { provide: PAYMENT_CONFIRMATION, inject: [DB_CLIENT], useFactory: provideConfirmation },
  ],
})
export class CommerceModule {}
