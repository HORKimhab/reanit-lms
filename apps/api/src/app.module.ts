import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { EnvModule } from "./config/env.module";
import { DbModule } from "./db/db.module";
import { RequestContextModule } from "./context/request-context";
import { HealthModule } from "./health/health.module";
import { HttpModule } from "./http/http.module";
import { LoggingModule } from "./logging/logging.module";
import { MailModule } from "./mail/mail.module";
import { RedisModule } from "./redis/redis.module";
import { SchoolsModule } from "./schools/schools.module";

/** Root module: shared infrastructure plus every feature module. */
@Module({
  imports: [EnvModule, LoggingModule, RequestContextModule, HttpModule, DbModule, RedisModule, MailModule, HealthModule, AuthModule, SchoolsModule, CatalogModule],
})
export class AppModule {}
