import { Module } from "@nestjs/common";
import { createSchoolService } from "@reanit/core/schools";
import { createSchoolStore, type DbClient } from "@reanit/db";

import { DB_CLIENT } from "@reanit/nest";
import { RolesGuard } from "./roles.guard";
import { SchoolsController } from "./schools.controller";
import { SCHOOL_SERVICE } from "./schools.tokens";

/**
 * Wires the school use cases to Postgres.
 *
 * @param db The shared database client.
 * @returns The school service.
 */
function provideSchoolService(db: DbClient) {
  return createSchoolService({ store: createSchoolStore(db) });
}

/** School routes, and `RolesGuard` for any module whose routes use `@Roles(...)`. */
@Module({
  controllers: [SchoolsController],
  providers: [{ provide: SCHOOL_SERVICE, inject: [DB_CLIENT], useFactory: provideSchoolService }, RolesGuard],
  exports: [SCHOOL_SERVICE, RolesGuard],
})
export class SchoolsModule {}
