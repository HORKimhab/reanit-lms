import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./redirect";

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
