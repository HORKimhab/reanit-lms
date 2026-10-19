import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { loggerOptions, REDACTED_PATHS } from "./logging";

/**
 * Logs one object through pino with the shared redaction and returns what was written.
 *
 * @param fields Fields to log.
 * @returns The written line, parsed.
 */
function logOnce(fields: object) {
  let written = "{}";
  /**
   * Keeps the line pino writes.
   *
   * @param line A JSON line.
   */
  function write(line: string) {
    written = line;
  }
  pino({ redact: REDACTED_PATHS }, { write }).info(fields);
  return JSON.parse(written) as Record<string, unknown>;
}

describe("REDACTED_PATHS", () => {
  it("redacts a logged password", () => {
    expect(logOnce({ password: "hunter22" })).toMatchObject({ password: "[Redacted]" });
  });

  it("redacts a password inside a logged object", () => {
    expect(logOnce({ input: { email: "a@example.com", password: "hunter22" } })).toMatchObject({
      input: { email: "a@example.com", password: "[Redacted]" },
    });
  });

  it("redacts the session cookie a response sets", () => {
    expect(logOnce({ res: { headers: { "set-cookie": "session=abc" } } })).toMatchObject({
      res: { headers: { "set-cookie": "[Redacted]" } },
    });
  });
});

describe("loggerOptions", () => {
  it("logs at the configured level with the shared redaction", () => {
    expect(loggerOptions({ LOG_LEVEL: "warn" })).toEqual({ level: "warn", redact: REDACTED_PATHS });
  });
});
