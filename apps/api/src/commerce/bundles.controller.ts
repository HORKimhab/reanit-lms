import { Body, Controller, Get, Inject, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { Bundle } from "@reanit/core/commerce";

import { Audited, pathParam } from "../audit/audit.decorator";
import { CurrentSchool, Roles, type StaffSchool } from "../schools/schools.decorators";
import {
  BundleResponse,
  BundleSlugParams,
  BundlesResponse,
  CreateBundleBody,
  IdParams,
  PriceBody,
  PriceResponse,
  toPriceResponse,
  UpdateBundleBody,
} from "./commerce.dto";
import { COMMERCE_FOR_SCHOOL, type CommerceForSchool } from "./commerce.tokens";

/**
 * Shapes a bundle for the response, without its price's id.
 *
 * @param bundle The bundle.
 * @returns The bundle as the API sends it.
 */
export function toBundleResponse(bundle: Bundle): BundleResponse["bundle"] {
  return { ...bundle, price: bundle.price && toPriceResponse(bundle.price) };
}

/** The bundle builder's routes: the caller's school's bundles, drafts included. */
@Controller("bundles")
@Roles("owner", "admin", "instructor")
export class BundlesController {
  /**
   * Receives the factory for per-school commerce services.
   *
   * @param commerceFor Builds a commerce service limited to one school.
   */
  constructor(@Inject(COMMERCE_FOR_SCHOOL) private readonly commerceFor: CommerceForSchool) {}

  /**
   * Lists the school's bundles, newest first.
   *
   * @param school The caller's school.
   * @returns The bundles.
   */
  @Get()
  @ApiOkResponse({ type: BundlesResponse })
  async list(@CurrentSchool() school: StaffSchool): Promise<BundlesResponse> {
    return { bundles: (await this.commerceFor(school.id).listBundles()).map(toBundleResponse) };
  }

  /**
   * Creates a draft bundle of the school's courses.
   *
   * @param school The caller's school.
   * @param body Its title and courses.
   * @returns The new bundle.
   * @throws {UnknownBundleCourseError} When a course is not the school's (400).
   */
  @Post()
  @Audited("bundle.create", ({ response }) => (response as BundleResponse).bundle.id)
  @ApiCreatedResponse({ type: BundleResponse })
  async create(@CurrentSchool() school: StaffSchool, @Body() body: CreateBundleBody): Promise<BundleResponse> {
    return { bundle: toBundleResponse(await this.commerceFor(school.id).createBundle(body)) };
  }

  /**
   * Loads a bundle, draft or published, for the builder.
   *
   * @param school The caller's school.
   * @param params The bundle's slug.
   * @returns The bundle.
   * @throws {BundleNotFoundError} When the school has no such bundle (404).
   */
  @Get("by-slug/:slug")
  @ApiOkResponse({ type: BundleResponse })
  async get(@CurrentSchool() school: StaffSchool, @Param() params: BundleSlugParams): Promise<BundleResponse> {
    return { bundle: toBundleResponse(await this.commerceFor(school.id).getBundle(params.slug)) };
  }

  /**
   * Changes a bundle's title, description, status or courses.
   *
   * @param school The caller's school.
   * @param params The bundle's id.
   * @param body The changes.
   * @returns The updated bundle.
   * @throws {UnknownBundleCourseError} When a course is not the school's (400).
   * @throws {BundleNotFoundError} When the school has no such bundle (404).
   */
  @Patch(":id")
  @Audited("bundle.update", pathParam("id"))
  @ApiOkResponse({ type: BundleResponse })
  async update(@CurrentSchool() school: StaffSchool, @Param() params: IdParams, @Body() body: UpdateBundleBody): Promise<BundleResponse> {
    return { bundle: toBundleResponse(await this.commerceFor(school.id).updateBundle(params.id, body)) };
  }

  /**
   * Sets a bundle's price; orders already placed keep theirs. Pricing is for owners and admins.
   *
   * @param school The caller's school.
   * @param params The bundle's id.
   * @param body Amount in minor units, currency and billing.
   * @returns The price.
   * @throws {BundleNotFoundError} When the school has no such bundle (404).
   */
  @Put(":id/price")
  @Roles("owner", "admin")
  @Audited("bundle.price.set", pathParam("id"))
  @ApiOkResponse({ type: PriceResponse })
  async setPrice(@CurrentSchool() school: StaffSchool, @Param() params: IdParams, @Body() body: PriceBody): Promise<PriceResponse> {
    return { price: toPriceResponse(await this.commerceFor(school.id).setBundlePrice(params.id, body)) };
  }
}
