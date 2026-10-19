import { Controller, Get } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { ClsService } from "nestjs-cls";
import { afterEach, describe, expect, it } from "vitest";

import { createTestApp } from "../test/app";
import type { RequestContext } from "./request-context";
import { REQUEST_ID_HEADER } from "./request-id";

/** Answers with the request id the request context holds while the handler runs. */
@Controller("context-probe")
class ContextProbeController {
  /**
   * Receives the request context.
   *
   * @param cls The request context.
   */
  constructor(private readonly cls: ClsService<RequestContext>) {}

  /**
   * Reads the current request's id from the context.
   *
   * @returns The id.
   */
  @Get()
  read() {
    return { requestId: this.cls.getId() };
  }
}

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/;

let app: NestFastifyApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

/**
 * Calls the probe route with the given headers.
 *
 * @param headers Request headers.
 * @returns The echoed `x-request-id` header and the id seen inside the handler.
 */
async function probe(headers: Record<string, string> = {}) {
  app = await createTestApp(undefined, { controllers: [ContextProbeController] });
  const response = await app.inject({ method: "GET", url: "/context-probe", headers });
  return { header: response.headers[REQUEST_ID_HEADER], seen: response.json<{ requestId: string }>().requestId };
}

describe("request context", () => {
  it("keeps the caller's request id in the context and the response", async () => {
    const { header, seen } = await probe({ [REQUEST_ID_HEADER]: "web-1234" });

    expect(seen).toBe("web-1234");
    expect(header).toBe("web-1234");
  });

  it("generates a UUID when the caller sends no request id", async () => {
    const { header, seen } = await probe();

    expect(seen).toMatch(UUID);
    expect(header).toBe(seen);
  });

  it("replaces a request id that could inject text into logs", async () => {
    const { header, seen } = await probe({ [REQUEST_ID_HEADER]: "x\nlevel=fatal" });

    expect(seen).toMatch(UUID);
    expect(header).toBe(seen);
  });

  it("gives each request its own id", async () => {
    app = await createTestApp(undefined, { controllers: [ContextProbeController] });

    const [first, second] = await Promise.all([
      app.inject({ method: "GET", url: "/context-probe" }),
      app.inject({ method: "GET", url: "/context-probe" }),
    ]);

    expect(first.json<{ requestId: string }>().requestId).not.toBe(second.json<{ requestId: string }>().requestId);
  });
});
