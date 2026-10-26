import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { SchoolService } from "@reanit/core/schools";

import { CurrentUser } from "../auth/auth.decorators";
import { SCHOOL_SERVICE } from "../schools/schools.tokens";
import { MyOrdersQuery, OrdersResponse, SchoolParams, toOrderDetailResponse } from "./commerce.dto";
import { ORDER_HISTORY_FOR_SCHOOL, type OrderHistoryForSchool } from "./commerce.tokens";

/** A student's purchases on a school site: their own orders, with what each bought, for receipts. */
@Controller("schools/by-subdomain/:subdomain")
export class PurchasesController {
  /**
   * Receives the school lookup and the factory for per-school order history.
   *
   * @param schools Resolves the school from its subdomain.
   * @param historyFor Builds an order history limited to one school.
   */
  constructor(
    @Inject(SCHOOL_SERVICE) private readonly schools: SchoolService,
    @Inject(ORDER_HISTORY_FOR_SCHOOL) private readonly historyFor: OrderHistoryForSchool,
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
}
