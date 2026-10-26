import { Module } from "@nestjs/common";
import { createCatalogService } from "@reanit/core/catalog";
import { createCatalogStore, type DbClient } from "@reanit/db";

import { DB_CLIENT } from "@reanit/nest";
import { SchoolsModule } from "../schools/schools.module";
import { PLAN_GUARD_FOR, type PlanGuardFor } from "../schools/schools.tokens";
import { CATALOG_FOR_SCHOOL, type CatalogForSchool } from "./catalog.tokens";
import { CoursesController } from "./courses.controller";
import { PublicCatalogController } from "./public-catalog.controller";

/**
 * Wires per-school catalogs to Postgres through the tenant client, with the school's plan.
 *
 * @param db The shared database client.
 * @param planFor Builds a school's plan guard, which limits its published courses.
 * @returns A factory of catalogs limited to one school.
 */
function provideCatalogForSchool(db: DbClient, planFor: PlanGuardFor): CatalogForSchool {
  return (schoolId) => createCatalogService({ store: createCatalogStore(db, schoolId), plan: planFor(schoolId) });
}

/** Course builder routes for staff and the public catalog of each school site. */
@Module({
  imports: [SchoolsModule],
  controllers: [CoursesController, PublicCatalogController],
  providers: [{ provide: CATALOG_FOR_SCHOOL, inject: [DB_CLIENT, PLAN_GUARD_FOR], useFactory: provideCatalogForSchool }],
})
export class CatalogModule {}
