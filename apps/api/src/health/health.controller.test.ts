import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFakeClients, createTestApp } from "../test/app";
import { PING_TIMEOUT_MS } from "./health.controller";

let app: NestFastifyApplication | undefined;

afterEach(async () => {
  vi.useRealTimers();
  await app?.close();
  app = undefined;
});

/**
 * Boots the app with the given fakes and requests `GET /health`.
 *
 * @param clients Fakes, already set up to answer or fail.
 * @returns The response status and parsed body.
 */
async function getHealth(clients = createFakeClients()) {
  app = await createTestApp(clients);
  const response = await app.inject({ method: "GET", url: "/health" });
  return { status: response.statusCode, body: response.json() };
}

describe("GET /health", () => {
  it("answers 200 when Postgres and Redis respond", async () => {
    const { status, body } = await getHealth();

    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "ok", details: { postgres: { status: "up" }, redis: { status: "up" } } });
  });

  it("answers 503 naming Postgres when the database is unreachable", async () => {
    const clients = createFakeClients();
    clients.db.$queryRaw.mockRejectedValue(new Error("connection refused"));

    const { status, body } = await getHealth(clients);

    expect(status).toBe(503);
    expect(body).toMatchObject({ status: "error", error: { postgres: { status: "down" } }, info: { redis: { status: "up" } } });
  });

  it("answers 503 naming Redis when it cannot be pinged", async () => {
    const clients = createFakeClients();
    clients.redis.ping.mockRejectedValue(new Error("Stream isn't writeable"));

    const { status, body } = await getHealth(clients);

    expect(status).toBe(503);
    expect(body).toMatchObject({ error: { redis: { status: "down", message: "Stream isn't writeable" } } });
  });

  it("reports Redis down when it does not answer within the timeout", async () => {
    const clients = createFakeClients();
    clients.redis.ping.mockReturnValue(new Promise(() => {}));
    app = await createTestApp(clients);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    const pending = app.inject({ method: "GET", url: "/health" });
    await vi.advanceTimersByTimeAsync(PING_TIMEOUT_MS);
    const response = await pending;

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { redis: { status: "down" } } });
  });
});

describe("shutdown", () => {
  it("closes the database pool and the Redis connection", async () => {
    const clients = createFakeClients();
    app = await createTestApp(clients);

    await app.close();
    app = undefined;

    expect(clients.db.$disconnect).toHaveBeenCalledOnce();
    expect(clients.redis.quit).toHaveBeenCalledOnce();
  });

  it("drops the Redis connection without QUIT when Redis is unreachable", async () => {
    const clients = createFakeClients();
    clients.redis.status = "reconnecting";
    app = await createTestApp(clients);

    await app.close();
    app = undefined;

    expect(clients.redis.disconnect).toHaveBeenCalledOnce();
    expect(clients.redis.quit).not.toHaveBeenCalled();
  });
});
