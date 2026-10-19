import { Module } from "@nestjs/common";
import { DbModule, EnvModule, LoggingModule } from "@reanit/nest";

import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CommerceModule } from "./commerce/commerce.module";
import { parseEnv } from "./config/env";
import { RequestContextModule } from "./context/request-context";
import { HealthModule } from "./health/health.module";
import { HttpModule } from "./http/http.module";
import { MailModule } from "./mail/mail.module";
import { MediaModule } from "./media/media.module";
import { RedisModule } from "./redis/redis.module";
import { SchoolsModule } from "./schools/schools.module";

/** Root module: shared infrastructure plus every feature module. */
@Module({
  imports: [
    EnvModule.forRoot(parseEnv),
    LoggingModule,
    RequestContextModule,
    HttpModule,
    DbModule,
    RedisModule,
    MailModule,
    HealthModule,
    AuthModule,
    SchoolsModule,
    CatalogModule,
    MediaModule,
    CommerceModule,
  ],
})
export class AppModule {}
