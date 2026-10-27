import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { PayoutAdmin } from "@reanit/core/commerce";

import { Audited } from "../audit/audit.decorator";
import { CurrentUser } from "../auth/auth.decorators";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { DuePayoutsResponse, RecordedPayoutResponse, RecordPayoutBody, toDuePayoutResponse, toPayoutResponse } from "./commerce.dto";
import { PAYOUT_ADMIN } from "./commerce.tokens";

/**
 * Finds the school a recorded payout went to, for its audit entry.
 *
 * @param response The record route's response.
 * @returns The school's id.
 */
function payoutSchool(response: unknown): string {
  return (response as RecordedPayoutResponse).payout.schoolId;
}

/** Payouts across schools, for the platform's admins: the ones due, and recording the transfers made. */
@Controller("admin/payouts")
@UseGuards(PlatformAdminGuard)
export class AdminPayoutsController {
  /**
   * Receives the admins' payout use cases.
   *
   * @param payouts Lists payouts due and records transfers.
   */
  constructor(@Inject(PAYOUT_ADMIN) private readonly payouts: PayoutAdmin) {}

  /**
   * Lists the payouts due: each school's available balance that reaches the minimum, with where to send it.
   *
   * @returns The payouts due.
   */
  @Get("due")
  @ApiOkResponse({ type: DuePayoutsResponse })
  async due(): Promise<DuePayoutsResponse> {
    return { payouts: (await this.payouts.listDuePayouts()).map(toDuePayoutResponse) };
  }

  /**
   * Records a transfer made to a school; it comes off the school's available balance. Logged in the school's audit log.
   *
   * @param body The school, currency, amount, date and reference.
   * @param admin The platform admin recording it.
   * @returns The payout.
   * @throws {PayoutExceedsBalanceError} When it is more than the school's available balance (409).
   */
  @Post()
  @Audited("payout.record", ({ response }) => (response as RecordedPayoutResponse).payout.id, payoutSchool)
  @ApiCreatedResponse({ type: RecordedPayoutResponse })
  async record(@Body() body: RecordPayoutBody, @CurrentUser() admin: AuthUser): Promise<RecordedPayoutResponse> {
    const payout = await this.payouts.recordPayout(body, admin.id);
    return { payout: { ...toPayoutResponse(payout), schoolId: body.schoolId } };
  }
}
