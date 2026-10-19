import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import { FastifyAdapter } from "@nestjs/platform-fastify";

/** Header a caller (e.g. a proxy or the web app) may send to correlate logs, echoed on every response. */
export const REQUEST_ID_HEADER = "x-request-id";

/** Incoming ids are kept only when short and plain, so a client cannot inject text into logs. */
const REQUEST_ID_PATTERN = /^[\w.:-]{1,128}$/;

/** A raw request after Fastify has assigned its id (Fastify copies it onto the raw request for middleware). */
type IdentifiedRequest = IncomingMessage & { id: string };

/**
 * Picks a request's id: the caller's `x-request-id` when valid, a new UUID otherwise.
 *
 * @param request The raw Node request.
 * @returns The id.
 */
function generateRequestId(request: IncomingMessage): string {
  const incoming = request.headers[REQUEST_ID_HEADER];
  return typeof incoming === "string" && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
}

/**
 * Creates the Fastify adapter. Fastify assigns every request's id, so its logs, the request
 * context and the response header all carry the same one; callers can quote it in bug reports.
 *
 * @param options How the API is reached.
 * @param options.trustProxyHops Proxies in front of the API whose X-Forwarded-For entries `request.ip` may come from; 0 trusts none.
 * @returns The adapter for `NestFactory.create`.
 */
export function createAdapter({ trustProxyHops = 0 }: { trustProxyHops?: number } = {}): FastifyAdapter {
  /**
   * Tells Fastify whether to look past an address for the caller's: it asks about each one from the
   * socket outwards, and only the configured proxies are trusted.
   *
   * @param _address The address it is asking about.
   * @param hop How far it is from the socket, 0 being the socket itself.
   * @returns Whether that hop is one of the trusted proxies.
   */
  function isTrustedProxy(_address: string, hop: number) {
    return hop < trustProxyHops;
  }
  const adapter = new FastifyAdapter({ genReqId: generateRequestId, trustProxy: isTrustedProxy });
  adapter.getInstance().addHook("onRequest", async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);
  });
  return adapter;
}

/**
 * Reads the id Fastify assigned to the request.
 *
 * @param request The raw Node request.
 * @returns The id.
 */
export function requestIdOf(request: IdentifiedRequest): string {
  return request.id;
}
