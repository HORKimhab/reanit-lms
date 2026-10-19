import { BadRequestException, Controller, Headers, HttpCode, HttpStatus, Inject, Logger, Post, Req, type RawBodyRequest } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { UnknownPaymentError, type PaymentConfirmation } from "@reanit/core/commerce";
import { ENV } from "@reanit/nest";
import type { FastifyRequest } from "fastify";
import Stripe from "stripe";

import { Public } from "../auth/auth.decorators";
import type { Env } from "../config/env";
import { PAYMENT_CONFIRMATION, STRIPE } from "./commerce.tokens";
import { paidSessionOf } from "./stripe-gateway";

/** Stripe calls this when a Checkout Session is paid; it is the only way a Stripe order enrolls. */
@Public()
@ApiExcludeController()
@Controller("webhooks/stripe")
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  /**
   * Receives Stripe, the confirmation use case and the environment.
   *
   * @param stripe Stripe client, or null when Stripe is not configured.
   * @param confirmation Marks orders paid and enrolls.
   * @param env Validated environment with the signing secret.
   */
  constructor(
    @Inject(STRIPE) private readonly stripe: Stripe | null,
    @Inject(PAYMENT_CONFIRMATION) private readonly confirmation: PaymentConfirmation,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Verifies the event's signature and confirms a paid session. Answers 200 for anything it does not
   * need, so Stripe stops retrying; a repeat of a paid session changes nothing.
   *
   * @param request The request with its raw body.
   * @param signature The `stripe-signature` header.
   * @throws {BadRequestException} When Stripe is not configured or the signature does not match (Stripe will retry).
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Req() request: RawBodyRequest<FastifyRequest>, @Headers("stripe-signature") signature?: string) {
    const secret = this.env.STRIPE_WEBHOOK_SECRET;
    if (!this.stripe || !secret || !request.rawBody || !signature) throw new BadRequestException("Unverifiable webhook.");
    let sessionId: string | null;
    try {
      sessionId = paidSessionOf(this.stripe, request.rawBody, signature, secret);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) throw new BadRequestException("Bad signature.");
      throw error;
    }
    if (!sessionId) return;
    try {
      await this.confirmation.confirm("stripe", sessionId);
    } catch (error) {
      if (!(error instanceof UnknownPaymentError)) throw error;
      this.logger.warn(`Paid Stripe session ${sessionId} matches no order`);
    }
  }
}
