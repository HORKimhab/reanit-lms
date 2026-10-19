import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger, LoggerErrorInterceptor } from "nestjs-pino";

/**
 * Applies what every instance of the app needs, in production and in tests alike:
 * security headers, cookie parsing, pino as Nest's logger (with the stack of errors a request throws), and shutdown on SIGTERM/SIGINT so Fastify
 * finishes in-flight requests and the modules close their pools.
 *
 * @param app The created, not yet listening, app.
 */
export async function setupApp(app: NestFastifyApplication) {
  await app.register(helmet);
  await app.register(cookie);

  app.useLogger(app.get(Logger));
  app.flushLogs();
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  app.enableShutdownHooks();
}
