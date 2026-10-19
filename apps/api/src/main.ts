import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module";
import { setupApp } from "./app.setup";
import { ENV, type Env } from "./config/env";
import { createAdapter } from "./context/request-id";

/**
 * Starts the API on Fastify. Boot logs are buffered until pino takes over as the logger.
 *
 * @throws {z.ZodError} When the environment is invalid.
 */
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createAdapter(), { bufferLogs: true });
  await setupApp(app);
  const { PORT, HOST } = app.get<Env>(ENV);
  await app.listen(PORT, HOST);
}

await bootstrap();
