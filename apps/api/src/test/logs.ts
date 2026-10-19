// Captures pino output in memory so tests can assert on what was logged.
import type { DestinationStream } from "pino";

/** Log lines written so far, parsed, and the stream to hand to pino. */
type CapturedLogs = { lines: Record<string, unknown>[]; stream: DestinationStream };

/**
 * Creates an in-memory pino destination.
 *
 * @returns The parsed lines (cleared with `lines.length = 0`) and the stream.
 */
export function captureLogs(): CapturedLogs {
  const lines: Record<string, unknown>[] = [];
  /**
   * Receives one serialized log line from pino.
   *
   * @param line A JSON line.
   */
  function write(line: string) {
    lines.push(JSON.parse(line) as Record<string, unknown>);
  }
  return { lines, stream: { write } };
}
