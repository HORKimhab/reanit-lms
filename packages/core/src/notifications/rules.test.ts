import { describe, expect, it } from "vitest";

import { schoolPageUrl } from "./rules";

describe("schoolPageUrl", () => {
  it("links an English reader to the unprefixed page", () => {
    expect(schoolPageUrl({ appUrl: "https://reanit.com", locale: "en", subdomain: "angkor", path: "/learn/brand" })).toBe(
      "https://reanit.com/s/angkor/learn/brand",
    );
  });

  it("links a Khmer reader to the /km page", () => {
    expect(schoolPageUrl({ appUrl: "https://reanit.com", locale: "km", subdomain: "angkor", path: "/my-courses" })).toBe(
      "https://reanit.com/km/s/angkor/my-courses",
    );
  });

  it("keeps the app's port for local development", () => {
    expect(schoolPageUrl({ appUrl: "http://localhost:3000", locale: "en", subdomain: "angkor", path: "/my-courses" })).toBe(
      "http://localhost:3000/s/angkor/my-courses",
    );
  });
});
