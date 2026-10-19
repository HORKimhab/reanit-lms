import { BullModule, type BullRootModuleOptions } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { baseEnvSchema, DbModule, ENV, EnvModule, LoggingModule, type BaseEnv } from "@reanit/nest";

import { EventsModule } from "./events/events.module";

/**
 * Validates the worker's environment: the shared variables, nothing more yet.
 *
 * @param source Variables to read.
 * @returns The validated variables with defaults applied.
 * @throws {z.ZodError} When a variable is missing or malformed.
 */
export function parseWorkerEnv(source: Record<string, string | undefined>): BaseEnv {
  return baseEnvSchema.parse(source);
}

/**
 * Points every BullMQ queue and worker at Redis. Workers need `maxRetriesPerRequest: null`
 * so blocking commands wait out a Redis restart instead of failing the job.
 *
 * @param env Validated environment.
 * @returns BullMQ's shared connection settings.
 */
export function bullOptions(env: BaseEnv): BullRootModuleOptions {
  return { connection: { url: env.REDIS_URL, maxRetriesPerRequest: null } };
}

/** Root of the background worker: shared env, logs and database, BullMQ, and the job modules. */
@Module({
  imports: [
    EnvModule.forRoot(parseWorkerEnv),
    LoggingModule,
    DbModule,
    BullModule.forRootAsync({ inject: [ENV], useFactory: bullOptions }),
    EventsModule,
  ],
})
export class WorkerModule {}
