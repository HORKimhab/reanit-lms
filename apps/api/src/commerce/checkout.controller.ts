import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { CommerceService, PaymentStart } from "@reanit/core/commerce";
import type { SchoolService } from "@reanit/core/schools";
import { ENV } from "@reanit/nest";

import { CurrentUser, Public } from "../auth/auth.decorators";
import type { Env } from "../config/env";
import { SCHOOL_SERVICE } from "../schools/schools.tokens";
import { RateLimit } from "../rate-limit/rate-limit";
import { CheckoutBody, CheckoutResponse, OfferParams, OfferQuery, OfferResponse, OrderParams, OrderResponse, SchoolParams } from "./commerce.dto";
import { COMMERCE_FOR_SCHOOL, type CommerceForSchool } from "./commerce.tokens";

/**
 * Describes the browser's next step without the gateway's reference, which stays on the server.
 *
 * @param payment What the gateway returned.
 * @returns The step for the response.
 */
function toPaymentStep(payment: PaymentStart): CheckoutResponse["payment"] {
  switch (payment.kind) {
    case "redirect":
      return { kind: "redirect", url: payment.url };
    case "form":
      return { kind: "form", action: payment.action, fields: payment.fields };
    case "qr":
      return { kind: "qr", qr: payment.qr, expiresAt: payment.expiresAt.toISOString() };
  }
}

/** Buying a course on a school site: its offer, checkout and the order's status. */
@Controller("schools/by-subdomain/:subdomain")
export class CheckoutController {
  /**
   * Receives the school lookup, the commerce factory and the environment.
   *
   * @param schools Resolves a subdomain to its school.
   * @param commerceFor Builds a commerce service limited to one school.
   * @param env Validated environment.
   */
  constructor(
    @Inject(SCHOOL_SERVICE) private readonly schools: SchoolService,
    @Inject(COMMERCE_FOR_SCHOOL) private readonly commerceFor: CommerceForSchool,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Picks the commerce service of the school a subdomain belongs to.
   *
   * @param subdomain The school's subdomain.
   * @returns That school's commerce service.
   * @throws {SchoolNotFoundError} When no school has the subdomain.
   */
  private async commerce(subdomain: string): Promise<CommerceService> {
    return this.commerceFor((await this.schools.getSchoolBySubdomain(subdomain)).id);
  }

  /**
   * Says how a published course can be bought: its price, the payment methods for its currency, and
   * what a coupon takes off, so the checkout page can show the total before paying.
   *
   * @param params The school's subdomain and the course's slug.
   * @param query The coupon code, if any.
   * @returns The price (null when not for sale), the methods and the discount (null without a coupon).
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   * @throws {CourseNotFoundError} When the school sells no such course (404).
   * @throws {InvalidCouponError} When the coupon is unknown, expired, used up or not for this price (400).
   */
  @Public()
  @Get("courses/:slug/offer")
  @ApiOkResponse({ type: OfferResponse })
  async offer(@Param() params: OfferParams, @Query() query: OfferQuery): Promise<OfferResponse> {
    const { price, methods, discount } = await (await this.commerce(params.subdomain)).getOffer(params.slug, query);
    return { price: price && { amount: price.amount, currency: price.currency }, methods, discount };
  }

  /**
   * Starts buying a course with the chosen method and coupon. Enrollment follows only the gateway's confirmation.
   *
   * @param params The school's subdomain.
   * @param body The course, payment method and coupon code.
   * @param user The signed-in buyer.
   * @returns The order and what the browser does next.
   * @throws {CourseNotForSaleError} When the course has no price (409).
   * @throws {AlreadyEnrolledError} When the buyer has the course (409).
   * @throws {PaymentMethodUnavailableError} When the method cannot take the payment (400).
   * @throws {InvalidCouponError} When the coupon cannot be used on this course (400).
   */
  @Post("checkout")
  @RateLimit("checkout")
  @ApiCreatedResponse({ type: CheckoutResponse })
  async checkout(@Param() params: SchoolParams, @Body() body: CheckoutBody, @CurrentUser() user: AuthUser): Promise<CheckoutResponse> {
    const schoolUrl = new URL(`/s/${params.subdomain}`, this.env.APP_URL).href;
    const { orderId, payment } = await (await this.commerce(params.subdomain)).checkout({ userId: user.id, email: user.email }, body, (id) => ({
      successUrl: `${schoolUrl}/orders/${id}`,
      cancelUrl: `${schoolUrl}/courses/${body.courseSlug}`,
    }));
    return { orderId, payment: toPaymentStep(payment) };
  }

  /**
   * Reads one of the buyer's orders, e.g. while waiting for the payment.
   *
   * @param params The school's subdomain and the order's id.
   * @param user The signed-in buyer.
   * @returns The order.
   * @throws {OrderNotFoundError} When the buyer has no such order in this school (404).
   */
  @Get("orders/:orderId")
  @ApiOkResponse({ type: OrderResponse })
  async order(@Param() params: OrderParams, @CurrentUser() user: AuthUser): Promise<OrderResponse> {
    // Picked field by field: the gateway's reference stays on the server.
    const { id, status, courseId, amount, currency, method } = await (await this.commerce(params.subdomain)).getOrder(params.orderId, user.id);
    return { order: { id, status, courseId, amount, currency, method } };
  }
}
