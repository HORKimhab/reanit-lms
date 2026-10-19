import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestApp } from "../test/app";
import { isTrustedOrigin } from "./origin.guard";

const APP_URL = "http://localhost:3000";

describe("isTrustedOrigin", () => {
  it.each([APP_URL, "http://angkor.localhost:3000"])("trusts the web app and its school subdomain %s", (origin) => {
    expect(isTrustedOrigin(origin, APP_URL)).toBe(true);
  });

  it.each([
    "http://evil.example",
    "https://localhost:3000",
    "http://localhost:3001",
    "http://evillocalhost:3000",
    "http://localhost:3000.evil.example",
    "null",
  ])("refuses %s", (origin) => {
    expect(isTrustedOrigin(origin, APP_URL)).toBe(false);
  });
});

describe("OriginGuard", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("refuses a mutating request from another site with 403 problem+json", async () => {
    const response = await app.inject({ method: "POST", url: "/auth/logout", headers: { origin: "http://evil.example" } });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ status: 403, title: "Forbidden" });
  });

  it.each([
    ["the web app", { origin: APP_URL }],
    ["a caller that sends no origin", {}],
  ])("lets a mutating request from %s through", async (_caller, headers) => {
    const response = await app.inject({ method: "POST", url: "/auth/logout", headers });

    expect(response.statusCode).toBe(204);
  });

  it("lets a read from another site through", async () => {
    const response = await app.inject({ method: "GET", url: "/health", headers: { origin: "http://evil.example" } });

    expect(response.statusCode).toBe(200);
  });
});
