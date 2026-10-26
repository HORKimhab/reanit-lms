import { BullModule, type BullRootModuleOptions } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import {
  baseEnvSchema,
  DbModule,
  ENV,
  EnvModule,
  LoggingModule,
  MailModule,
  mailEnvSchema,
  storageEnvSchema,
  StorageModule,
  TelemetryModule,
} from "@reanit/nest";
import { z } from "zod";

import { EventsModule } from "./events/events.module";
import { OrdersModule } from "./orders/orders.module";

const workerEnvSchema = baseEnvSchema.extend({
  /** Public origin of the web app, for links in emails and certificates. */
  APP_URL: z.url(),
  ...mailEnvSchema.shape,
  ...storageEnvSchema.shape,
});

/** The worker's validated environment. */
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

/**
 * Validates the worker's environment: the shared variables, plus what sending email and storing certificates need.
 *
 * @param source Variables to read.
 * @returns The validated variables with defaults applied.
 * @throws {z.ZodError} When a variable is missing or malformed.
 */
export function parseWorkerEnv(source: Record<string, string | undefined>): WorkerEnv {
  return workerEnvSchema.parse(source);
}

/**
 * Points every BullMQ queue and worker at Redis. Workers need `maxRetriesPerRequest: null`
 * so blocking commands wait out a Redis restart instead of failing the job.
 *
 * @param env Validated environment.
 * @returns BullMQ's shared connection settings.
 */
export function bullOptions(env: WorkerEnv): BullRootModuleOptions {
  return { connection: { url: env.REDIS_URL, maxRetriesPerRequest: null } };
}

/** Root of the background worker: shared env, logs, telemetry flush, database, mail and storage, BullMQ, the job modules and order upkeep. */
@Module({
  imports: [
    EnvModule.forRoot(parseWorkerEnv),
    LoggingModule,
    TelemetryModule,
    DbModule,
    MailModule,
    StorageModule,
    BullModule.forRootAsync({ inject: [ENV], useFactory: bullOptions }),
    EventsModule,
    OrdersModule,
  ],
})
export class WorkerModule {}
