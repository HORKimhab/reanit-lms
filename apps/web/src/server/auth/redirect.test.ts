import { describe, expect, it } from "vitest";

import { nextFromQuery } from "./redirect";

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
