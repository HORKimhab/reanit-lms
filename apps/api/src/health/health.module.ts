import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthController } from "./health.controller";
import { PingHealthIndicator } from "./ping.health";

/** Serves `GET /health`. */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PingHealthIndicator],
})
export class HealthModule {}
