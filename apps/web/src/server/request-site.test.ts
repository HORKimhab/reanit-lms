// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { requestHeaders } from "@/test/headers";

import { getRequestSite } from "./request-site";

vi.mock("next/headers", () => import("@/test/headers"));

describe("getRequestSite", () => {
  it("builds an https origin from the host", async () => {
    requestHeaders.set("host", "angkor.reanit.com");

    expect(await getRequestSite()).toEqual({ host: "angkor.reanit.com", origin: "https://angkor.reanit.com" });
  });

  it("uses http for local development", async () => {
    requestHeaders.set("host", "localhost:3000");

    expect((await getRequestSite()).origin).toBe("http://localhost:3000");
  });

  it("trusts the proxy's forwarded host and scheme", async () => {
    requestHeaders.set("host", "web:3000");
    requestHeaders.set("x-forwarded-host", "angkor.reanit.com");
    requestHeaders.set("x-forwarded-proto", "https");

    expect(await getRequestSite()).toEqual({ host: "angkor.reanit.com", origin: "https://angkor.reanit.com" });
  });
});
