import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";

import { OriginGuard } from "./origin.guard";
import { ProblemDetailsFilter } from "./problem.filter";
import { ZodValidationPipe } from "./zod-validation.pipe";

/** Edge rules for every route: cross-site mutations refused, zod validation in, problem+json out. */
@Module({
  providers: [
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class HttpModule {}
