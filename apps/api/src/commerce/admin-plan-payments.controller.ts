import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { PlatformAdmin } from "@reanit/core/schools";

import { Audited, pathParam } from "../audit/audit.decorator";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminIdParams, PlanPaymentDecisionResponse, SubmittedPlanPaymentsResponse, toSubmittedPlanPaymentResponse } from "./commerce.dto";
import { PLATFORM_ADMIN } from "./commerce.tokens";

/**
 * Finds the school of a plan payment an admin decided, for its audit entry.
 *
 * @param response The route's response.
 * @returns The school's id.
 */
function paymentSchool(response: unknown): string {
  return (response as PlanPaymentDecisionResponse).payment.schoolId;
}

/** Creators' plan payments to the platform's QR, for its admins: the ones waiting, and confirming or rejecting each. */
@Controller("admin/plan-payments")
@UseGuards(PlatformAdminGuard)
export class AdminPlanPaymentsController {
  /**
   * Receives the platform admins' use cases.
   *
   * @param admin Lists, confirms and rejects plan payments to the platform's QR.
   */
  constructor(@Inject(PLATFORM_ADMIN) private readonly admin: PlatformAdmin) {}

  /**
   * Lists the payments to the platform's QR whose creators say they paid, oldest first.
   *
   * @returns The payments.
   */
  @Get()
  @ApiOkResponse({ type: SubmittedPlanPaymentsResponse })
  async list(): Promise<SubmittedPlanPaymentsResponse> {
    return { payments: (await this.admin.listPlanPayments()).map(toSubmittedPlanPaymentResponse) };
  }

  /**
   * Confirms a payment found in the platform's account: it is paid and its school's plan moves on. Logged in the school's audit log.
   *
   * @param params The payment's id.
   * @returns The payment, paid.
   * @throws {PlanPaymentNotFoundError} When no school has such a payment (404).
   * @throws {PlanPaymentClosedError} When it is not a pending payment to the platform's QR (409).
   */
  @Post(":id/confirm")
  @HttpCode(HttpStatus.OK)
  @Audited("plan_payment.confirm", pathParam("id"), paymentSchool)
  @ApiOkResponse({ type: PlanPaymentDecisionResponse })
  async confirm(@Param() params: AdminIdParams): Promise<PlanPaymentDecisionResponse> {
    const { schoolId } = await this.admin.confirmPlanPayment(params.id);
    return { payment: { id: params.id, schoolId, status: "paid" } };
  }

  /**
   * Rejects a payment that never arrived: it fails and the plan stays as it is. Logged in the school's audit log.
   *
   * @param params The payment's id.
   * @returns The payment, failed.
   * @throws {PlanPaymentNotFoundError} When no school has such a payment (404).
   * @throws {PlanPaymentClosedError} When it is not a pending payment to the platform's QR (409).
   */
  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  @Audited("plan_payment.reject", pathParam("id"), paymentSchool)
  @ApiOkResponse({ type: PlanPaymentDecisionResponse })
  async reject(@Param() params: AdminIdParams): Promise<PlanPaymentDecisionResponse> {
    const { schoolId } = await this.admin.rejectPlanPayment(params.id);
    return { payment: { id: params.id, schoolId, status: "failed" } };
  }
}
