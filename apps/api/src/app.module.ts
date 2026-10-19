import { Module } from "@nestjs/common";

import { EnvModule } from "./config/env.module";
import { DbModule } from "./db/db.module";
import { HealthModule } from "./health/health.module";
import { RedisModule } from "./redis/redis.module";

/** Root module: shared infrastructure plus every feature module. */
@Module({
  imports: [EnvModule, DbModule, RedisModule, HealthModule],
})
export class AppModule {}
