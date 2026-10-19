import { Module } from "@nestjs/common";
import { createCatalogService } from "@reanit/core/catalog";
import { createCatalogStore, type DbClient } from "@reanit/db";

import { DB_CLIENT } from "../db/db.module";
import { SchoolsModule } from "../schools/schools.module";
import { CATALOG_FOR_SCHOOL, type CatalogForSchool } from "./catalog.tokens";
import { CoursesController } from "./courses.controller";
import { PublicCatalogController } from "./public-catalog.controller";

/**
 * Wires per-school catalogs to Postgres through the tenant client.
 *
 * @param db The shared database client.
 * @returns A factory of catalogs limited to one school.
 */
function provideCatalogForSchool(db: DbClient): CatalogForSchool {
  return (schoolId) => createCatalogService({ store: createCatalogStore(db, schoolId) });
}

/** Course builder routes for staff and the public catalog of each school site. */
@Module({
  imports: [SchoolsModule],
  controllers: [CoursesController, PublicCatalogController],
  providers: [{ provide: CATALOG_FOR_SCHOOL, inject: [DB_CLIENT], useFactory: provideCatalogForSchool }],
})
export class CatalogModule {}
