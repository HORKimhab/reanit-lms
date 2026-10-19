import { describe, expect, it } from "vitest";

import { pageSchema, pageWindow } from "./paging";

describe("pageWindow", () => {
  it("starts the first page at the first row", () => {
    expect(pageWindow(1, 50)).toEqual({ limit: 50, offset: 0 });
  });

  it("skips the earlier pages' rows", () => {
    expect(pageWindow(3, 50)).toEqual({ limit: 50, offset: 100 });
  });
});

describe("pageSchema", () => {
  it("defaults to the first page and reads a page from a query string", () => {
    expect(pageSchema.parse(undefined)).toBe(1);
    expect(pageSchema.parse("4")).toBe(4);
  });

  it.each(["0", "-1", "1.5", "two"])("rejects %s", (page) => {
    expect(pageSchema.safeParse(page).success).toBe(false);
  });
});
