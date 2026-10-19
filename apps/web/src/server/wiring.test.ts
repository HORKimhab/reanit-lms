// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://reanit:reanit@localhost:5432/reanit");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("SMTP_URL", "smtp://localhost:1025");
  vi.stubEnv("MAIL_FROM", "Reanit <no-reply@reanit.test>");
  // Both modules memoize; reload them so each test starts cold. Neither connects until first use.
  vi.resetModules();
});

describe("server wiring", () => {
  it("shares one database client across hot reloads", async () => {
    const first = (await import("./db")).getDb();
    vi.resetModules();

    expect((await import("./db")).getDb()).toBe(first);
  });

  it("builds the auth service once", async () => {
    const { getAuthService } = await import("./auth/service");

    expect(getAuthService()).toBe(getAuthService());
  });
});
