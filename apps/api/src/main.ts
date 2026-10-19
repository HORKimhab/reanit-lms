import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module";
import { ENV, type Env } from "./config/env";

/**
 * Starts the API on Fastify. Shutdown hooks let SIGTERM close the database and Redis cleanly.
 *
 * @throws {z.ZodError} When the environment is invalid.
 */
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.enableShutdownHooks();
  const { PORT, HOST } = app.get<Env>(ENV);
  await app.listen(PORT, HOST);
}

await bootstrap();
