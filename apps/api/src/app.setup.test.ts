import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, it } from "vitest";

import { createTestApp } from "./test/app";

let app: NestFastifyApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("security headers", () => {
  it("sends helmet's headers on every response", async () => {
    app = await createTestApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["strict-transport-security"]).toContain("max-age=");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });
});
