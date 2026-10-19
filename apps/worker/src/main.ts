import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";

import { WorkerModule } from "./worker.module";

/**
 * Starts the worker as a Nest application context: no HTTP server, only job processors.
 * Shutdown hooks let SIGTERM finish the running jobs and close Redis and the database.
 *
 * @throws {z.ZodError} When the environment is invalid.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.flushLogs();
  app.enableShutdownHooks();
  app.get(Logger).log("Worker started", "Worker");
}

await bootstrap();
