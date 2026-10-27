import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";

import { CurrentSchool, Roles, type StaffSchool } from "../schools/schools.decorators";
import { AuditEventsResponse, AuditQuery } from "./audit.dto";
import { AUDIT_FOR_SCHOOL, type AuditFor } from "./audit.tokens";

/** The school's audit log, for its owner and admins. */
@Controller("audit-events")
@Roles("owner", "admin")
export class AuditController {
  /**
   * Receives the factory for per-school audit logs.
   *
   * @param auditFor Builds an audit log limited to one school.
   */
  constructor(@Inject(AUDIT_FOR_SCHOOL) private readonly auditFor: AuditFor) {}

  /**
   * Lists one page of what the school's staff did, newest first.
   *
   * @param school The caller's school.
   * @param query The 1-based page.
   * @returns The page's entries and how many there are.
   */
  @Get()
  @ApiOkResponse({ type: AuditEventsResponse })
  async list(@CurrentSchool() school: StaffSchool, @Query() query: AuditQuery): Promise<AuditEventsResponse> {
    const page = await this.auditFor(school.id).listEntries(query);
    return { ...page, entries: page.entries.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })) };
  }
}
