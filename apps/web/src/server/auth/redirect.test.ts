import { describe, expect, it } from "vitest";

import { nextFromQuery, safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it.each(["/dashboard", "/km/s/angkor/my-courses?tab=all", "/"])("keeps the local path %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "dashboard", ""])(
    "falls back to home when given %s",
    (path) => {
      expect(safeRedirectPath(path)).toBe("/");
    },
  );

  it("falls back to home when the value is missing", () => {
    expect(safeRedirectPath(null)).toBe("/");
  });
});

describe("nextFromQuery", () => {
  it("returns a safe local path", () => {
    expect(nextFromQuery("/dashboard")).toBe("/dashboard");
  });

  it("returns home for an off-site path", () => {
    expect(nextFromQuery("//evil.example")).toBe("/");
  });

  it.each([[undefined], [["/a", "/b"]]])("returns undefined for %j", (value) => {
    expect(nextFromQuery(value)).toBeUndefined();
  });
});
