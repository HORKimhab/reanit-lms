import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseEnv } from "./env";

const REQUIRED = {
  DATABASE_URL: "postgresql://reanit:reanit@localhost:5432/reanit",
  REDIS_URL: "redis://localhost:6379",
  APP_URL: "http://localhost:3000",
  SMTP_URL: "smtp://localhost:1025",
  MAIL_FROM: "Reanit <no-reply@reanit.localhost>",
};

describe("parseEnv", () => {
  it("applies the default port, host and log level", () => {
    expect(parseEnv(REQUIRED)).toEqual({ ...REQUIRED, PORT: 4000, HOST: "0.0.0.0", LOG_LEVEL: "info" });
  });

  it("throws a ZodError for an unknown log level", () => {
    expect(() => parseEnv({ ...REQUIRED, LOG_LEVEL: "verbose" })).toThrow(ZodError);
  });

  it("reads the port as a number", () => {
    expect(parseEnv({ ...REQUIRED, PORT: "8080" }).PORT).toBe(8080);
  });

  it.each(["DATABASE_URL", "REDIS_URL", "APP_URL", "SMTP_URL", "MAIL_FROM"])("throws a ZodError when %s is missing", (name) => {
    expect(() => parseEnv({ ...REQUIRED, [name]: undefined })).toThrow(ZodError);
  });

  it.each(["0", "65536", "http"])("throws a ZodError for the port %s", (port) => {
    expect(() => parseEnv({ ...REQUIRED, PORT: port })).toThrow(ZodError);
  });
});
