import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("joins class names and drops falsy ones", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("applies conditional object classes", () => {
    expect(cn({ active: true, hidden: false })).toBe("active");
  });

  it("lets a later Tailwind class override a conflicting earlier one", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });

  it("returns an empty string when given nothing", () => {
    expect(cn()).toBe("");
  });
});
