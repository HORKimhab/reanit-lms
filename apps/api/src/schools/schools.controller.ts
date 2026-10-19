import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { SchoolService } from "@reanit/core/schools";

import { CurrentUser, Public } from "../auth/auth.decorators";
import type { RequestContext } from "../context/request-context";
import { CurrentSchool, Roles } from "./schools.decorators";
import { CreateSchoolBody, SchoolResponse, StaffSchoolResponse, SubdomainParams } from "./schools.dto";
import { SCHOOL_SERVICE } from "./schools.tokens";

/** Opening schools and finding them by subdomain, over `@reanit/core/schools`. */
@Controller("schools")
export class SchoolsController {
  /**
   * Receives the school use cases.
   *
   * @param schools The school use cases.
   */
  constructor(@Inject(SCHOOL_SERVICE) private readonly schools: SchoolService) {}

  /**
   * Opens a school owned by the signed-in creator.
   *
   * @param body Name and subdomain.
   * @param user The signed-in creator.
   * @returns The new school.
   * @throws {SubdomainTakenError} When another school has the subdomain (409).
   */
  @Post()
  @ApiCreatedResponse({ type: SchoolResponse })
  async create(@Body() body: CreateSchoolBody, @CurrentUser() user: AuthUser): Promise<SchoolResponse> {
    return { school: await this.schools.createSchool(body, user.id) };
  }

  /**
   * Returns the school the signed-in creator runs, with their role in it.
   *
   * @param current The school `@Roles` resolved.
   * @returns The school and role.
   */
  @Get("current")
  @Roles("owner", "admin", "instructor")
  @ApiOkResponse({ type: StaffSchoolResponse })
  current(@CurrentSchool() current: NonNullable<RequestContext["school"]>): StaffSchoolResponse {
    const { role, ...school } = current;
    return { school, role };
  }

  /**
   * Finds the school a subdomain belongs to, for school sites.
   *
   * @param params The subdomain.
   * @returns The school.
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   */
  @Public()
  @Get("by-subdomain/:subdomain")
  @ApiOkResponse({ type: SchoolResponse })
  async bySubdomain(@Param() params: SubdomainParams): Promise<SchoolResponse> {
    return { school: await this.schools.getSchoolBySubdomain(params.subdomain) };
  }
}
