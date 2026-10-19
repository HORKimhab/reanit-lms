import { Module } from "@nestjs/common";
import { createAnalyticsService } from "@reanit/core/analytics";
import { createStatsStore, type DbClient } from "@reanit/db";
import { DB_CLIENT } from "@reanit/nest";

import { systemClock } from "../context/clock";
import { SchoolsModule } from "../schools/schools.module";
import { ANALYTICS_FOR_SCHOOL, type AnalyticsForSchool } from "./analytics.tokens";
import { StatsController } from "./stats.controller";

/**
 * Wires per-school stats services to Postgres through the tenant client.
 *
 * @param db The shared database client.
 * @returns A factory of stats services limited to one school.
 */
function provideAnalyticsForSchool(db: DbClient): AnalyticsForSchool {
  return (schoolId) => createAnalyticsService({ store: createStatsStore(db, schoolId), clock: systemClock });
}

/** Dashboard stats and the sales report. */
@Module({
  imports: [SchoolsModule],
  controllers: [StatsController],
  providers: [{ provide: ANALYTICS_FOR_SCHOOL, inject: [DB_CLIENT], useFactory: provideAnalyticsForSchool }],
})
export class AnalyticsModule {}
