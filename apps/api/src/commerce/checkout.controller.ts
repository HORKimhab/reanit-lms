import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { CommerceService, PaymentStart } from "@reanit/core/commerce";
import type { School, SchoolService } from "@reanit/core/schools";
import { ENV } from "@reanit/nest";

import { CurrentUser, Public } from "../auth/auth.decorators";
import type { Env } from "../config/env";
import { SCHOOL_SERVICE } from "../schools/schools.tokens";
import { RateLimit } from "../rate-limit/rate-limit";
import { toBundleResponse } from "./bundles.controller";
import {
  BundleCheckoutBody,
  BundleResponse,
  CheckoutBody,
  CheckoutResponse,
  OfferParams,
  OfferQuery,
  OfferResponse,
  OfflinePaymentBody,
  OrderParams,
  OrderResponse,
  RenewBody,
  SchoolParams,
  SubscriptionParams,
  toPriceResponse,
} from "./commerce.dto";
import { COMMERCE_FOR_SCHOOL, type CommerceForSchool } from "./commerce.tokens";

/**
 * Describes the browser's next step without the gateway's reference, which stays on the server.
 *
 * @param payment What checkout returned.
 * @param school The school, whose payment QR image an offline payment shows.
 * @returns The step for the response.
 */
function toPaymentStep(payment: PaymentStart, school: School): CheckoutResponse["payment"] {
  switch (payment.kind) {
    case "redirect":
      return { kind: "redirect", url: payment.url };
    case "form":
      return { kind: "form", action: payment.action, fields: payment.fields };
    case "qr":
      return { kind: "qr", qr: payment.qr, expiresAt: payment.expiresAt.toISOString() };
    case "offline":
      // Checkout offers the offline QR only to a school that uploaded its payment QR image.
      return { kind: "offline", qrImageUrl: school.paymentQrUrl! };
  }
}

/** Buying a course or bundle on a school site: its offer, checkout and the order's status. */
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
   * Finds the school a subdomain belongs to, with its commerce service.
   *
   * @param subdomain The school's subdomain.
   * @returns The school and its commerce service.
   * @throws {SchoolNotFoundError} When no school has the subdomain.
   */
  private async schoolCommerce(subdomain: string): Promise<{ school: School; commerce: CommerceService }> {
    const school = await this.schools.getSchoolBySubdomain(subdomain);
    return { school, commerce: this.commerceFor(school.id) };
  }

  /**
   * Picks the commerce service of the school a subdomain belongs to.
   *
   * @param subdomain The school's subdomain.
   * @returns That school's commerce service.
   * @throws {SchoolNotFoundError} When no school has the subdomain.
   */
  private async commerce(subdomain: string): Promise<CommerceService> {
    return (await this.schoolCommerce(subdomain)).commerce;
  }

  /**
   * Builds where a gateway sends the student back: the order's status page, or the page they bought from.
   *
   * @param subdomain The school's subdomain.
   * @param cancelPath The page the student bought from, under the school.
   * @returns The return URLs for a new order.
   */
  private returnUrls(subdomain: string, cancelPath: string) {
    const schoolUrl = new URL(`/s/${subdomain}`, this.env.APP_URL).href;
    return (orderId: string) => ({ successUrl: `${schoolUrl}/orders/${orderId}`, cancelUrl: `${schoolUrl}${cancelPath}` });
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
    return { price: price && toPriceResponse(price), methods, discount };
  }

  /**
   * Starts buying a course with the chosen method and coupon: at once for a one-time price, or the
   * first period of a subscription or payment plan. Enrollment follows only a confirmed payment.
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
    const urls = this.returnUrls(params.subdomain, `/courses/${body.courseSlug}`);
    const { school, commerce } = await this.schoolCommerce(params.subdomain);
    const { orderId, payment } = await commerce.checkout({ userId: user.id, email: user.email }, body, urls);
    return { orderId, payment: toPaymentStep(payment, school) };
  }

  /**
   * Loads a published bundle with its courses, for its sales page.
   *
   * @param params The school's subdomain and the bundle's slug.
   * @returns The bundle.
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   * @throws {BundleNotFoundError} When the school has no published bundle with the slug (404).
   */
  @Public()
  @Get("bundles/:slug")
  @ApiOkResponse({ type: BundleResponse })
  async bundle(@Param() params: OfferParams): Promise<BundleResponse> {
    return { bundle: toBundleResponse(await (await this.commerce(params.subdomain)).getPublishedBundle(params.slug)) };
  }

  /**
   * Says how a published bundle can be bought, like a course's offer.
   *
   * @param params The school's subdomain and the bundle's slug.
   * @param query The coupon code, if any.
   * @returns The price (null when not for sale), the methods and the discount (null without a coupon).
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   * @throws {BundleNotFoundError} When the school sells no such bundle (404).
   * @throws {InvalidCouponError} When the coupon cannot be used on the bundle (400).
   */
  @Public()
  @Get("bundles/:slug/offer")
  @ApiOkResponse({ type: OfferResponse })
  async bundleOffer(@Param() params: OfferParams, @Query() query: OfferQuery): Promise<OfferResponse> {
    const { price, methods, discount } = await (await this.commerce(params.subdomain)).getBundleOffer(params.slug, query);
    return { price: price && toPriceResponse(price), methods, discount };
  }

  /**
   * Starts buying a bundle: one order for all its courses. Enrollment in each follows only the gateway's confirmation.
   *
   * @param params The school's subdomain.
   * @param body The bundle, payment method and coupon code.
   * @param user The signed-in buyer.
   * @returns The order and what the browser does next.
   * @throws {BundleNotFoundError} When the school sells no such bundle (404).
   * @throws {CourseNotForSaleError} When the bundle has no price (409).
   * @throws {AlreadyEnrolledError} When the buyer has every course of the bundle (409).
   * @throws {PaymentMethodUnavailableError} When the method cannot take the payment (400).
   * @throws {InvalidCouponError} When the coupon cannot be used on this bundle (400).
   */
  @Post("bundle-checkout")
  @RateLimit("checkout")
  @ApiCreatedResponse({ type: CheckoutResponse })
  async checkoutBundle(@Param() params: SchoolParams, @Body() body: BundleCheckoutBody, @CurrentUser() user: AuthUser): Promise<CheckoutResponse> {
    const urls = this.returnUrls(params.subdomain, `/bundles/${body.bundleSlug}`);
    const { school, commerce } = await this.schoolCommerce(params.subdomain);
    const { orderId, payment } = await commerce.checkoutBundle({ userId: user.id, email: user.email }, body, urls);
    return { orderId, payment: toPaymentStep(payment, school) };
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

  /**
   * Pays a subscription's next period or a payment plan's next instalment; a lapsed subscription comes back this way.
   *
   * @param params The school's subdomain and the subscription's id.
   * @param body How to pay and the receipt's language.
   * @param user The signed-in student.
   * @returns The order and what the browser does next.
   * @throws {SubscriptionNotFoundError} When the student has no such subscription in this school (404).
   * @throws {SubscriptionNotRenewableError} When its first payment is still open or the plan is paid off (409).
   * @throws {PaymentMethodUnavailableError} When the method cannot take the payment (400).
   */
  @Post("subscriptions/:subscriptionId/renew")
  @RateLimit("checkout")
  @ApiCreatedResponse({ type: CheckoutResponse })
  async renew(@Param() params: SubscriptionParams, @Body() body: RenewBody, @CurrentUser() user: AuthUser): Promise<CheckoutResponse> {
    const urls = this.returnUrls(params.subdomain, "/purchases");
    const { school, commerce } = await this.schoolCommerce(params.subdomain);
    const { orderId, payment } = await commerce.renewSubscription({ userId: user.id, email: user.email }, params.subscriptionId, body, urls);
    return { orderId, payment: toPaymentStep(payment, school) };
  }

  /**
   * Records that the student paid an offline QR order, with their transaction reference; staff then confirm it.
   *
   * @param params The school's subdomain and the order's id.
   * @param body The transaction reference.
   * @param user The signed-in student.
   * @throws {OrderNotFoundError} When the student has no such order in this school (404).
   * @throws {OfflinePaymentClosedError} When it is not a pending offline QR order (409).
   */
  @Post("orders/:orderId/offline-payment")
  @RateLimit("checkout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async submitOfflinePayment(@Param() params: OrderParams, @Body() body: OfflinePaymentBody, @CurrentUser() user: AuthUser) {
    await (await this.commerce(params.subdomain)).submitOfflinePayment(params.orderId, user.id, body);
  }
}
