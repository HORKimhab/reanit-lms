import request from "supertest";
import { describe, expect, it } from "vitest";

import { RATE_LIMITS } from "../src/rate-limit/rate-limit";
import { uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp({ isRateLimited: true });

/**
 * Asks for a magic link for an email.
 *
 * @param email The email.
 * @returns The response.
 */
function requestLink(email: string) {
  return request(e2e().app.getHttpServer()).post("/auth/magic-link").send({ email });
}

// Every request here comes from 127.0.0.1, so the file stays under the per-address limit; that one is tested in src/rate-limit.
describe("rate limits in Redis", () => {
  it("blocks an email after its magic links for the hour, keeps it blocked, and leaves other emails open", async () => {
    const email = `${uniqueName("limited")}@example.com`;
    for (let attempt = 0; attempt < RATE_LIMITS.magicLink.account.limit; attempt += 1) await requestLink(email).expect(202);

    const blocked = await requestLink(email).expect(429);
    const stillBlocked = await requestLink(email).expect(429);

    expect(blocked.body.type).toBe("urn:reanit:problem:rate-limited");
    expect(Number(blocked.headers["retry-after"])).toBe(RATE_LIMITS.magicLink.account.ttl / 1000);
    expect(Number(stillBlocked.headers["retry-after"])).toBeLessThanOrEqual(RATE_LIMITS.magicLink.account.ttl / 1000);
    expect(e2e().mail.filter((message) => message.to === email)).toHaveLength(RATE_LIMITS.magicLink.account.limit);
    await requestLink(`${uniqueName("other")}@example.com`).expect(202);
  });
});
