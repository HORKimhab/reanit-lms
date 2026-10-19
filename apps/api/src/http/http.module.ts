import { Module } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";

import { ProblemDetailsFilter } from "./problem.filter";
import { ZodValidationPipe } from "./zod-validation.pipe";

/** Edge rules for every route: zod validation in, problem+json out. */
@Module({
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class HttpModule {}
