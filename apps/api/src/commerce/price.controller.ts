import { Body, Controller, Inject, Param, Put } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";

import { Audited, pathParam } from "../audit/audit.decorator";
import { CourseIdParams } from "../catalog/catalog.dto";
import type { RequestContext } from "../context/request-context";
import { CurrentSchool, Roles } from "../schools/schools.decorators";
import { PriceBody, PriceResponse, toPriceResponse } from "./commerce.dto";
import { COMMERCE_FOR_SCHOOL, type CommerceForSchool } from "./commerce.tokens";

/** Sets what a course costs. */
@Controller("courses/:id/price")
@Roles("owner", "admin")
export class PriceController {
  /**
   * Receives the factory for per-school commerce services.
   *
   * @param commerceFor Builds a commerce service limited to one school.
   */
  constructor(@Inject(COMMERCE_FOR_SCHOOL) private readonly commerceFor: CommerceForSchool) {}

  /**
   * Sets a course's price; orders already placed keep theirs.
   *
   * @param school The caller's school.
   * @param params The course's id.
   * @param body Amount in minor units, currency and billing.
   * @returns The price.
   * @throws {CourseNotFoundError} When the school has no such course (404).
   */
  @Put()
  @Audited("course.price.set", pathParam("id"))
  @ApiOkResponse({ type: PriceResponse })
  async set(
    @CurrentSchool() school: NonNullable<RequestContext["school"]>,
    @Param() params: CourseIdParams,
    @Body() body: PriceBody,
  ): Promise<PriceResponse> {
    return { price: toPriceResponse(await this.commerceFor(school.id).setPrice(params.id, body)) };
  }
}
