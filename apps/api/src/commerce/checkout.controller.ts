import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { CommerceService } from "@reanit/core/commerce";
import type { SchoolService } from "@reanit/core/schools";
import { ENV } from "@reanit/nest";

import { CurrentUser, Public } from "../auth/auth.decorators";
import type { Env } from "../config/env";
import { SCHOOL_SERVICE } from "../schools/schools.tokens";
import { CheckoutBody, CheckoutResponse, OfferParams, OfferResponse, OrderParams, OrderResponse, SchoolParams } from "./commerce.dto";
import { COMMERCE_FOR_SCHOOL, type CommerceForSchool } from "./commerce.tokens";

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
   * Says how a published course can be bought: its price and the payment methods for its currency.
   *
   * @param params The school's subdomain and the course's slug.
   * @returns The price (null when not for sale) and the methods.
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   * @throws {CourseNotFoundError} When the school sells no such course (404).
   */
  @Public()
  @Get("courses/:slug/offer")
  @ApiOkResponse({ type: OfferResponse })
  async offer(@Param() params: OfferParams): Promise<OfferResponse> {
    const { price, methods } = await (await this.commerce(params.subdomain)).getOffer(params.slug);
    return { price: price && { amount: price.amount, currency: price.currency }, methods };
  }

  /**
   * Starts buying a course with the chosen method. Enrollment follows only the gateway's confirmation.
   *
   * @param params The school's subdomain.
   * @param body The course and payment method.
   * @param user The signed-in buyer.
   * @returns The order and what the browser does next.
   * @throws {CourseNotForSaleError} When the course has no price (409).
   * @throws {AlreadyEnrolledError} When the buyer has the course (409).
   * @throws {PaymentMethodUnavailableError} When the method cannot take the payment (400).
   */
  @Post("checkout")
  @ApiCreatedResponse({ type: CheckoutResponse })
  async checkout(@Param() params: SchoolParams, @Body() body: CheckoutBody, @CurrentUser() user: AuthUser): Promise<CheckoutResponse> {
    const schoolUrl = new URL(`/s/${params.subdomain}`, this.env.APP_URL).href;
    const { orderId, payment } = await (await this.commerce(params.subdomain)).checkout({ userId: user.id, email: user.email }, body, (id) => ({
      successUrl: `${schoolUrl}/orders/${id}`,
      cancelUrl: `${schoolUrl}/courses/${body.courseSlug}`,
    }));
    return {
      orderId,
      payment:
        payment.kind === "redirect"
          ? { kind: "redirect", url: payment.url }
          : { kind: "qr", qr: payment.qr, expiresAt: payment.expiresAt.toISOString() },
    };
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
    return { order: await (await this.commerce(params.subdomain)).getOrder(params.orderId, user.id) };
  }
}
