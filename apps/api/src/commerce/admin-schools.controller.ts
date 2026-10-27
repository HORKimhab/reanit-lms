import { Body, Controller, Delete, Get, Inject, Param, Put, Query, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { PlatformAdmin } from "@reanit/core/schools";

import { Audited, pathParam } from "../audit/audit.decorator";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminIdParams, PlatformSchoolsQuery, PlatformSchoolsResponse, SchoolSuspensionResponse, SuspendSchoolBody, toPlatformSchoolResponse, toSuspensionResponse } from "./commerce.dto";
import { PLATFORM_ADMIN } from "./commerce.tokens";

/**
 * Finds the school whose suspension changed, for its audit entry.
 *
 * @param response The route's response.
 * @returns The school's id.
 */
function suspendedSchool(response: unknown): string {
  return (response as SchoolSuspensionResponse).schoolId;
}

/** Every school on the platform, for its admins: the list with each plan in force, and taking a school offline and back. */
@Controller("admin/schools")
@UseGuards(PlatformAdminGuard)
export class AdminSchoolsController {
  /**
   * Receives the platform admins' use cases.
   *
   * @param admin Lists schools and suspends them.
   */
  constructor(@Inject(PLATFORM_ADMIN) private readonly admin: PlatformAdmin) {}

  /**
   * Lists one page of schools, newest first, optionally searched by name, subdomain or owner's email.
   *
   * @param query The search and page.
   * @returns The page.
   */
  @Get()
  @ApiOkResponse({ type: PlatformSchoolsResponse })
  async list(@Query() query: PlatformSchoolsQuery): Promise<PlatformSchoolsResponse> {
    const { schools, ...page } = await this.admin.listSchools(query);
    return { schools: schools.map(toPlatformSchoolResponse), ...page };
  }

  /**
   * Takes a school offline: its site, catalog, checkout and player answer 404. Logged in the school's audit log.
   *
   * @param params The school's id.
   * @param body Why.
   * @returns The suspension.
   * @throws {SchoolNotFoundError} When no school has the id (404).
   */
  @Put(":id/suspension")
  @Audited("school.suspend", pathParam("id"), suspendedSchool)
  @ApiOkResponse({ type: SchoolSuspensionResponse })
  async suspend(@Param() params: AdminIdParams, @Body() body: SuspendSchoolBody): Promise<SchoolSuspensionResponse> {
    return { schoolId: params.id, suspension: toSuspensionResponse(await this.admin.suspendSchool(params.id, body)) };
  }

  /**
   * Brings a suspended school back online. Logged in the school's audit log.
   *
   * @param params The school's id.
   * @returns The school with no suspension.
   * @throws {SchoolNotFoundError} When no school has the id (404).
   */
  @Delete(":id/suspension")
  @Audited("school.unsuspend", pathParam("id"), suspendedSchool)
  @ApiOkResponse({ type: SchoolSuspensionResponse })
  async unsuspend(@Param() params: AdminIdParams): Promise<SchoolSuspensionResponse> {
    await this.admin.unsuspendSchool(params.id);
    return { schoolId: params.id, suspension: null };
  }
}
