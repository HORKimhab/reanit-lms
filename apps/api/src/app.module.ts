import { Module } from "@nestjs/common";
import { DbModule, EnvModule, LoggingModule, MailModule, StorageModule, TelemetryModule } from "@reanit/nest";

import { AnalyticsModule } from "./analytics/analytics.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CommerceModule } from "./commerce/commerce.module";
import { parseEnv } from "./config/env";
import { RequestContextModule } from "./context/request-context";
import { HealthModule } from "./health/health.module";
import { HttpModule } from "./http/http.module";
import { LearningModule } from "./learning/learning.module";
import { MediaModule } from "./media/media.module";
import { RateLimitModule } from "./rate-limit/rate-limit";
import { RedisModule } from "./redis/redis.module";
import { SchoolsModule } from "./schools/schools.module";

/** Root module: shared infrastructure plus every feature module. */
@Module({
  imports: [
    EnvModule.forRoot(parseEnv),
    LoggingModule,
    TelemetryModule,
    RequestContextModule,
    HttpModule,
    DbModule,
    RedisModule,
    RateLimitModule,
    MailModule,
    StorageModule,
    HealthModule,
    AuthModule,
    SchoolsModule,
    CatalogModule,
    MediaModule,
    CommerceModule,
    LearningModule,
    AnalyticsModule,
    AuditModule,
  ],
})
export class AppModule {}
