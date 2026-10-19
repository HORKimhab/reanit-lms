import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REQUEST_ID_HEADER } from "./request-id";
import { createTestApp } from "../test/app";
import { captureLogs } from "../test/logs";

// nestjs-pino builds its logger once per process, so every app in this file shares one stream.
const { lines, stream: logStream } = captureLogs();

let app: NestFastifyApplication;

beforeEach(async () => {
  lines.length = 0;
  app = await createTestApp(undefined, { logStream });
});

afterEach(async () => {
  await app.close();
});

/**
 * Waits for the line pino-http writes once the response has finished.
 *
 * @returns The request-completed line.
 */
async function requestLine() {
  const line = await vi.waitFor(() => {
    const found = lines.find((entry) => entry.msg === "request completed");
    expect(found).toBeDefined();
    return found;
  });
  return line as { req: { id: string; headers: Record<string, string> } };
}

describe("request logs", () => {
  it("logs each request with its request id and status", async () => {
    await app.inject({ method: "GET", url: "/health", headers: { [REQUEST_ID_HEADER]: "web-42" } });

    expect(await requestLine()).toMatchObject({ req: { id: "web-42" }, res: { statusCode: 200 } });
  });

  it("redacts the cookie and authorization headers", async () => {
    await app.inject({
      method: "GET",
      url: "/health",
      headers: { cookie: "session=secret-token", authorization: "Bearer secret-token" },
    });

    const { req } = await requestLine();
    expect(req.headers.cookie).toBe("[Redacted]");
    expect(req.headers.authorization).toBe("[Redacted]");
    expect(JSON.stringify(lines)).not.toContain("secret-token");
  });
});
