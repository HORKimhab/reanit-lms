import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { createAuditLog } from "@reanit/core/audit";
import { createAuditStore, type DbClient } from "@reanit/db";
import { DB_CLIENT } from "@reanit/nest";

import { SchoolsModule } from "../schools/schools.module";
import { AuditController } from "./audit.controller";
import { AuditInterceptor } from "./audit.interceptor";
import { AUDIT_FOR_SCHOOL, type AuditFor } from "./audit.tokens";

/**
 * Wires per-school audit logs to Postgres through the tenant client.
 *
 * @param db The shared database client.
 * @returns A factory of audit logs limited to one school.
 */
function provideAuditFor(db: DbClient): AuditFor {
  return (schoolId) => createAuditLog({ store: createAuditStore(db, schoolId) });
}

/** The audit log: records `@Audited` staff routes and lists them for owners and admins. */
@Module({
  imports: [SchoolsModule],
  controllers: [AuditController],
  providers: [
    { provide: AUDIT_FOR_SCHOOL, inject: [DB_CLIENT], useFactory: provideAuditFor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AuditModule {}
