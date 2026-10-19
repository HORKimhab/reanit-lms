import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Inject, Logger, Post } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { UnknownPaymentError, type PaymentConfirmation, type PaymentGateway } from "@reanit/core/commerce";

import { Public } from "../auth/auth.decorators";
import { PAYMENT_CONFIRMATION, PAYWAY } from "./commerce.tokens";

/**
 * PayWay's pushback after a payment. The payload is only a hint: the transaction is looked up with
 * PayWay's check-transaction API, so a forged pushback cannot enroll anyone.
 */
@Public()
@ApiExcludeController()
@Controller("webhooks/payway")
export class PayWayWebhookController {
  private readonly logger = new Logger(PayWayWebhookController.name);

  /**
   * Receives PayWay and the confirmation use case.
   *
   * @param payway The PayWay gateway, or null when PayWay is not configured.
   * @param confirmation Marks orders paid and enrolls.
   */
  constructor(
    @Inject(PAYWAY) private readonly payway: PaymentGateway | null,
    @Inject(PAYMENT_CONFIRMATION) private readonly confirmation: PaymentConfirmation,
  ) {}

  /**
   * Checks the pushed transaction with PayWay and confirms it when approved.
   *
   * @param body The pushback, carrying `tran_id`.
   * @throws {BadRequestException} When PayWay is not configured or no transaction id was sent.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Body() body: unknown) {
    const tranId = (body as { tran_id?: unknown } | undefined)?.tran_id;
    if (!this.payway?.checkPayment || typeof tranId !== "string" || !tranId) throw new BadRequestException("Unusable pushback.");
    if ((await this.payway.checkPayment(tranId)) !== "paid") return;
    try {
      await this.confirmation.confirm("aba_payway", tranId);
    } catch (error) {
      if (!(error instanceof UnknownPaymentError)) throw error;
      this.logger.warn(`Approved PayWay transaction ${tranId} matches no order`);
    }
  }
}
