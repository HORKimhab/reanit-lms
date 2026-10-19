import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { Coupon } from "@reanit/core/commerce";

import { Audited, pathParam } from "../audit/audit.decorator";
import type { RequestContext } from "../context/request-context";
import { CurrentSchool, Roles } from "../schools/schools.decorators";
import { CouponIdParams, CouponResponse, CouponsResponse, CreateCouponBody } from "./commerce.dto";
import { COMMERCE_FOR_SCHOOL, type CommerceForSchool } from "./commerce.tokens";

/** The staff school `@Roles` resolved for the request. */
type StaffSchool = NonNullable<RequestContext["school"]>;

/**
 * Shapes a coupon for the response, with its expiry as an ISO date.
 *
 * @param coupon The coupon.
 * @returns The coupon as the API sends it.
 */
function toCouponResponse(coupon: Coupon): CouponResponse["coupon"] {
  return { ...coupon, expiresAt: coupon.expiresAt?.toISOString() ?? null };
}

/** A school's coupon codes, which students type at checkout. */
@Controller("coupons")
@Roles("owner", "admin")
export class CouponsController {
  /**
   * Receives the factory for per-school commerce services.
   *
   * @param commerceFor Builds a commerce service limited to one school.
   */
  constructor(@Inject(COMMERCE_FOR_SCHOOL) private readonly commerceFor: CommerceForSchool) {}

  /**
   * Lists the school's coupons with how often each was used.
   *
   * @param school The caller's school.
   * @returns The coupons, newest first.
   */
  @Get()
  @ApiOkResponse({ type: CouponsResponse })
  async list(@CurrentSchool() school: StaffSchool): Promise<CouponsResponse> {
    return { coupons: (await this.commerceFor(school.id).listCoupons()).map(toCouponResponse) };
  }

  /**
   * Creates a coupon.
   *
   * @param school The caller's school.
   * @param body The coupon's code, discount, expiry and usage limit.
   * @returns The new coupon.
   * @throws {CouponCodeTakenError} When the school already has the code (409).
   */
  @Post()
  @Audited("coupon.create", ({ response }) => (response as CouponResponse).coupon.id)
  @ApiCreatedResponse({ type: CouponResponse })
  async create(@CurrentSchool() school: StaffSchool, @Body() body: CreateCouponBody): Promise<CouponResponse> {
    return { coupon: toCouponResponse(await this.commerceFor(school.id).createCoupon(body.coupon)) };
  }

  /**
   * Deletes a coupon; orders that used it keep their price.
   *
   * @param school The caller's school.
   * @param params The coupon's id.
   * @throws {CouponNotFoundError} When the school has no such coupon (404).
   */
  @Delete(":id")
  @Audited("coupon.delete", pathParam("id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentSchool() school: StaffSchool, @Param() params: CouponIdParams) {
    await this.commerceFor(school.id).deleteCoupon(params.id);
  }
}
