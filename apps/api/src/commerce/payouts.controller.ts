import { Body, Controller, Get, Inject, Put } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";

import { Audited, currentSchool } from "../audit/audit.decorator";
import { CurrentSchool, Roles, type StaffSchool } from "../schools/schools.decorators";
import { PayoutAccountBody, PayoutAccountResponse, SchoolPayoutsResponse, toBalancesResponse, toPayoutResponse } from "./commerce.dto";
import { PAYOUTS_FOR_SCHOOL, type PayoutsForSchool } from "./commerce.tokens";

/** What the platform owes a school and pays it out: the balance, the payout details and the payouts made. */
@Controller("schools/current")
export class PayoutsController {
  /**
   * Receives the factory for per-school payouts.
   *
   * @param payoutsFor Builds payouts limited to one school.
   */
  constructor(@Inject(PAYOUTS_FOR_SCHOOL) private readonly payoutsFor: PayoutsForSchool) {}

  /**
   * Reads what the platform owes the school, when and above what it pays out, where to, and what it paid.
   *
   * @param school The caller's school.
   * @returns The balances, the next payout date, the minimums, the payout details and the payouts, newest first.
   */
  @Get("payouts")
  @Roles("owner", "admin")
  @ApiOkResponse({ type: SchoolPayoutsResponse })
  async payouts(@CurrentSchool() school: StaffSchool): Promise<SchoolPayoutsResponse> {
    const payouts = this.payoutsFor(school.id);
    const [{ balances, nextPayoutDate, minimums }, account, made] = await Promise.all([payouts.getBalance(), payouts.getAccount(), payouts.listPayouts()]);
    return { balances: toBalancesResponse(balances), nextPayoutDate: nextPayoutDate.toISOString(), minimums, account, payouts: made.map(toPayoutResponse) };
  }

  /**
   * Saves where the school's payouts are sent. Only the owner says where the school's money goes.
   *
   * @param school The caller's school.
   * @param body The account holder, bank and account number or Bakong ID.
   * @returns The saved details.
   */
  @Put("payout-account")
  @Roles("owner")
  @Audited("school.payout_account.update", currentSchool)
  @ApiOkResponse({ type: PayoutAccountResponse })
  async saveAccount(@CurrentSchool() school: StaffSchool, @Body() body: PayoutAccountBody): Promise<PayoutAccountResponse> {
    return { account: await this.payoutsFor(school.id).saveAccount(body) };
  }
}
