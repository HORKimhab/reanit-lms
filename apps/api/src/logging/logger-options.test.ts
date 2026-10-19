import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { captureLogs } from "../test/logs";
import { REDACTED_PATHS } from "./logger-options";

/**
 * Logs one object through pino with the API's redaction and returns what was written.
 *
 * @param fields Fields to log.
 * @returns The written line, parsed.
 */
function logOnce(fields: object) {
  const { lines, stream } = captureLogs();
  pino({ redact: REDACTED_PATHS }, stream).info(fields);
  return lines[0];
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
