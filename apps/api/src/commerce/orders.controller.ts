import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";

import { Audited, pathParam } from "../audit/audit.decorator";
import { CurrentSchool, Roles, type StaffSchool } from "../schools/schools.decorators";
import { IdParams, OrderDetailResponse, OrderListQuery, OrdersResponse, RefundBody, toOrderDetailResponse } from "./commerce.dto";
import { COMMERCE_FOR_SCHOOL, ORDER_HISTORY_FOR_SCHOOL, type CommerceForSchool, type OrderHistoryForSchool } from "./commerce.tokens";

/** The school's orders for its owner and admins: the list with filters, one order, its refund, and confirming or rejecting offline QR payments. */
@Controller("orders")
@Roles("owner", "admin")
export class OrdersController {
  /**
   * Receives the factories for per-school commerce services and order history.
   *
   * @param commerceFor Builds a commerce service limited to one school.
   * @param historyFor Builds an order history limited to one school.
   */
  constructor(
    @Inject(COMMERCE_FOR_SCHOOL) private readonly commerceFor: CommerceForSchool,
    @Inject(ORDER_HISTORY_FOR_SCHOOL) private readonly historyFor: OrderHistoryForSchool,
  ) {}

  /**
   * Lists the school's orders, newest first, filtered by status, course, currency and the days they were placed.
   *
   * @param school The caller's school.
   * @param query Filters and page.
   * @returns One page of orders.
   */
  @Get()
  @ApiOkResponse({ type: OrdersResponse })
  async list(@CurrentSchool() school: StaffSchool, @Query() query: OrderListQuery): Promise<OrdersResponse> {
    const page = await this.historyFor(school.id).listOrders(query);
    return { ...page, orders: page.orders.map(toOrderDetailResponse) };
  }

  /**
   * Reads one of the school's orders with its courses and buyer.
   *
   * @param school The caller's school.
   * @param params The order's id.
   * @returns The order.
   * @throws {OrderNotFoundError} When the school has no such order (404).
   */
  @Get(":id")
  @ApiOkResponse({ type: OrderDetailResponse })
  async get(@CurrentSchool() school: StaffSchool, @Param() params: IdParams): Promise<OrderDetailResponse> {
    return { order: toOrderDetailResponse(await this.historyFor(school.id).getOrder(params.id)) };
  }

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

  /**
   * Confirms that an offline QR payment arrived in the school's account: the order is paid and
   * enrolls its buyer, through the same confirmation as gateway payments.
   *
   * @param school The caller's school.
   * @param params The order's id.
   * @throws {OrderNotFoundError} When the school has no such order (404).
   * @throws {OfflinePaymentClosedError} When it is not an offline QR order, or is already paid or refunded (409).
   */
  @Post(":id/confirm-payment")
  @Audited("order.payment.confirm", pathParam("id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmPayment(@CurrentSchool() school: StaffSchool, @Param() params: IdParams) {
    await this.commerceFor(school.id).confirmOfflinePayment(params.id);
  }

  /**
   * Rejects an offline QR payment that never arrived: the order fails and enrolls nobody.
   *
   * @param school The caller's school.
   * @param params The order's id.
   * @throws {OrderNotFoundError} When the school has no such order (404).
   * @throws {OfflinePaymentClosedError} When it is not an offline QR order still waiting for payment or confirmation (409).
   */
  @Post(":id/reject-payment")
  @Audited("order.payment.reject", pathParam("id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async rejectPayment(@CurrentSchool() school: StaffSchool, @Param() params: IdParams) {
    await this.commerceFor(school.id).rejectOfflinePayment(params.id);
  }
}
