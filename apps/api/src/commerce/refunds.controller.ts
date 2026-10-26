import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Post } from "@nestjs/common";

import { Audited, pathParam } from "../audit/audit.decorator";
import type { RequestContext } from "../context/request-context";
import { CurrentSchool, Roles } from "../schools/schools.decorators";
import { IdParams, RefundBody } from "./commerce.dto";
import { COMMERCE_FOR_SCHOOL, type CommerceForSchool } from "./commerce.tokens";

/** The staff school `@Roles` resolved for the request. */
type StaffSchool = NonNullable<RequestContext["school"]>;

/** Refunds of the school's paid orders, for its owner and admins. */
@Controller("orders")
@Roles("owner", "admin")
export class RefundsController {
  /**
   * Receives the factory for per-school commerce services.
   *
   * @param commerceFor Builds a commerce service limited to one school.
   */
  constructor(@Inject(COMMERCE_FOR_SCHOOL) private readonly commerceFor: CommerceForSchool) {}

  /**
   * Refunds a paid order in full and takes back its courses: through Stripe, or for KHQR and PayWay
   * once staff say they paid the student back themselves.
   *
   * @param school The caller's school.
   * @param params The order's id.
   * @param body Whether staff already refunded by hand.
   * @throws {OrderNotFoundError} When the school has no such order (404).
   * @throws {OrderNotRefundableError} When the order is not paid (409).
   * @throws {RefundByHandRequiredError} When the gateway cannot refund and staff have not refunded by hand (409).
   */
  @Post(":id/refund")
  @Audited("order.refund", pathParam("id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async refund(@CurrentSchool() school: StaffSchool, @Param() params: IdParams, @Body() body: RefundBody) {
    await this.commerceFor(school.id).refundOrder(params.id, body);
  }
}
