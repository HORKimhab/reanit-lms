import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { SchoolService } from "@reanit/core/schools";

import { CurrentUser } from "../auth/auth.decorators";
import { SCHOOL_SERVICE } from "../schools/schools.tokens";
import { MyOrdersQuery, OrdersResponse, SchoolParams, SubscriptionsResponse, toOrderDetailResponse, toSubscriptionResponse } from "./commerce.dto";
import { COMMERCE_FOR_SCHOOL, ORDER_HISTORY_FOR_SCHOOL, type CommerceForSchool, type OrderHistoryForSchool } from "./commerce.tokens";

/** A student's purchases on a school site: their own orders, with what each bought, for receipts, and their subscriptions and payment plans. */
@Controller("schools/by-subdomain/:subdomain")
export class PurchasesController {
  /**
   * Receives the school lookup and the factories for per-school order history and commerce.
   *
   * @param schools Resolves the school from its subdomain.
   * @param historyFor Builds an order history limited to one school.
   * @param commerceFor Builds a commerce service limited to one school.
   */
  constructor(
    @Inject(SCHOOL_SERVICE) private readonly schools: SchoolService,
    @Inject(ORDER_HISTORY_FOR_SCHOOL) private readonly historyFor: OrderHistoryForSchool,
    @Inject(COMMERCE_FOR_SCHOOL) private readonly commerceFor: CommerceForSchool,
  ) {}

  /**
   * Lists the signed-in student's own orders in the school, newest first.
   *
   * @param params The school's subdomain.
   * @param query The page.
   * @param user The signed-in student.
   * @returns One page of their orders.
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   */
  @Get("orders")
  @ApiOkResponse({ type: OrdersResponse })
  async list(@Param() params: SchoolParams, @Query() query: MyOrdersQuery, @CurrentUser() user: AuthUser): Promise<OrdersResponse> {
    const school = await this.schools.getSchoolBySubdomain(params.subdomain);
    const page = await this.historyFor(school.id).listMyOrders(user.id, query);
    return { ...page, orders: page.orders.map(toOrderDetailResponse) };
  }

  /**
   * Lists the signed-in student's subscriptions and payment plans in the school, with where each stands.
   *
   * @param params The school's subdomain.
   * @param user The signed-in student.
   * @returns Every subscription they ever paid, newest first; one past its grace week shows as lapsed.
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   */
  @Get("subscriptions")
  @ApiOkResponse({ type: SubscriptionsResponse })
  async subscriptions(@Param() params: SchoolParams, @CurrentUser() user: AuthUser): Promise<SubscriptionsResponse> {
    const school = await this.schools.getSchoolBySubdomain(params.subdomain);
    return { subscriptions: (await this.commerceFor(school.id).listMySubscriptions(user.id)).map(toSubscriptionResponse) };
  }
}
