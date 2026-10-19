import { describe, expect, it } from "vitest";

import { MAGIC_LINK_MINUTES, magicLinkUrl } from "./magic-link-url";

describe("magicLinkUrl", () => {
  it("links to the verify route on the web origin with the token and next path encoded", () => {
    expect(magicLinkUrl({ appUrl: "http://localhost:3000", token: "tok en/1", next: "/courses?tab=all" })).toBe(
      "http://localhost:3000/api/auth/magic-link/verify?token=tok+en%2F1&next=%2Fcourses%3Ftab%3Dall",
    );
  });
});

describe("MAGIC_LINK_MINUTES", () => {
  it("is the link's lifetime in minutes", () => {
    expect(MAGIC_LINK_MINUTES).toBe(15);
  });
});
