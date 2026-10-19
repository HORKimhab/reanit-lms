import { describe, expect, it } from "vitest";

import { slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Angkor Academy", "angkor-academy"],
    ["  Café   Angkor!! ", "cafe-angkor"],
    ["Code 101", "code-101"],
    ["សាលា Angkor", "angkor"],
    ["សាលាអង្គរ", ""],
  ])("slugifies %j as %j", (text, slug) => {
    expect(slugify(text, 63)).toBe(slug);
  });

  it("cuts at the maximum length without leaving a trailing hyphen", () => {
    expect(slugify("abcd efgh", 5)).toBe("abcd");
  });
});
