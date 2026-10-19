import { describe, expect, it } from "vitest";

import { COMMENT_MAX_LENGTH, commentInboxQuerySchema, commentSchema } from "./comments";

describe("commentSchema", () => {
  it("trims the text and takes an optional thread to reply to", () => {
    expect(commentSchema.parse({ body: "  Hello  " })).toEqual({ body: "Hello" });
    expect(commentSchema.parse({ body: "Hi", parentId: "0b9a6d1e-5c3f-4a2b-9e8d-7c6b5a4f3e01" }).parentId).toBe("0b9a6d1e-5c3f-4a2b-9e8d-7c6b5a4f3e01");
  });

  it.each([
    ["blank text", { body: "   " }],
    ["text over the limit", { body: "x".repeat(COMMENT_MAX_LENGTH + 1) }],
    ["a thread id that is not a UUID", { body: "Hi", parentId: "c1" }],
  ])("rejects %s", (_case, comment) => {
    expect(commentSchema.safeParse(comment).success).toBe(false);
  });
});

describe("commentInboxQuerySchema", () => {
  it("defaults to the first page of unanswered threads", () => {
    expect(commentInboxQuerySchema.parse({})).toEqual({ page: 1, filter: "unanswered" });
  });

  it("reads the page from a query string and rejects an unknown filter", () => {
    expect(commentInboxQuerySchema.parse({ page: "3", filter: "all" })).toEqual({ page: 3, filter: "all" });
    expect(commentInboxQuerySchema.safeParse({ filter: "spam" }).success).toBe(false);
  });
});
