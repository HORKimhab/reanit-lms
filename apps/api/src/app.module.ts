import { Module } from "@nestjs/common";

import { EnvModule } from "./config/env.module";
import { DbModule } from "./db/db.module";
import { RequestContextModule } from "./context/request-context";
import { HealthModule } from "./health/health.module";
import { LoggingModule } from "./logging/logging.module";
import { RedisModule } from "./redis/redis.module";

/** Root module: shared infrastructure plus every feature module. */
@Module({
  imports: [EnvModule, LoggingModule, RequestContextModule, DbModule, RedisModule, HealthModule],
})
export class AppModule {}
