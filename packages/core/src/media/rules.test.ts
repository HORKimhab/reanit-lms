import { describe, expect, it } from "vitest";

import { lessonMediaPrefix, mediaExtension, uploadRequestSchema } from "./rules";

describe("mediaExtension", () => {
  it.each([
    ["video", "video/mp4", "mp4"],
    ["video", "video/webm", "webm"],
    ["pdf", "application/pdf", "pdf"],
  ] as const)("stores a %s lesson's %s as .%s", (type, contentType, extension) => {
    expect(mediaExtension(type, contentType)).toBe(extension);
  });

  it.each([
    ["text", "video/mp4"],
    ["video", "application/pdf"],
    ["video", "constructor"],
  ] as const)("has none for a %s lesson's %s", (type, contentType) => {
    expect(mediaExtension(type, contentType)).toBeUndefined();
  });
});

describe("lessonMediaPrefix", () => {
  it("nests the lesson under its school", () => {
    expect(lessonMediaPrefix("s1", "l1")).toBe("schools/s1/lessons/l1/");
  });
});

describe("uploadRequestSchema", () => {
  it("normalizes the content type", () => {
    expect(uploadRequestSchema.parse({ contentType: " Video/MP4 ", sizeBytes: 1 })).toEqual({ contentType: "video/mp4", sizeBytes: 1 });
  });

  it.each([0, -1, 1.5])("rejects a size of %s", (sizeBytes) => {
    expect(uploadRequestSchema.safeParse({ contentType: "video/mp4", sizeBytes }).success).toBe(false);
  });
});
