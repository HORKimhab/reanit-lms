import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { bullOptions, parseWorkerEnv } from "./worker.module";

const ENVIRONMENT = {
  DATABASE_URL: "postgresql://reanit:reanit@localhost:5432/reanit",
  REDIS_URL: "redis://localhost:6379",
};

describe("parseWorkerEnv", () => {
  it("applies the default log level", () => {
    expect(parseWorkerEnv(ENVIRONMENT)).toEqual({ ...ENVIRONMENT, LOG_LEVEL: "info" });
  });

  it.each(["DATABASE_URL", "REDIS_URL"])("throws a ZodError when %s is missing", (name) => {
    expect(() => parseWorkerEnv({ ...ENVIRONMENT, [name]: undefined })).toThrow(ZodError);
  });
});

describe("bullOptions", () => {
  it("connects to REDIS_URL and lets blocking commands wait out a Redis restart", () => {
    expect(bullOptions(parseWorkerEnv(ENVIRONMENT))).toEqual({
      connection: { url: ENVIRONMENT.REDIS_URL, maxRetriesPerRequest: null },
    });
  });
});
