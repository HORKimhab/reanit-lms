// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { getCustomDomainSettings } from "./domain-settings";

vi.mock("next/headers", () => import("@/test/headers"));

const DOMAIN = {
  hostname: "learn.angkor.com",
  status: "awaiting_dns",
  dnsRecords: [{ type: "CNAME", name: "learn.angkor.com", value: "customers.reanit.com" }],
} as const;

beforeEach(() => {
  signIn();
});

describe("getCustomDomainSettings", () => {
  it("returns whether domains are offered and the school's domain", async () => {
    onApi("GET /schools/current/domain", Response.json({ isAvailable: true, domain: DOMAIN }));

    expect(await getCustomDomainSettings()).toEqual({ isAvailable: true, domain: DOMAIN });
  });

  it("sends a signed-out visitor to log in", async () => {
    onApi("GET /schools/current/domain", problem(401));

    await expect(getCustomDomainSettings()).rejects.toThrow(RedirectError);
  });
});
