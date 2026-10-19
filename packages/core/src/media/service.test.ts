import { beforeEach, describe, expect, it } from "vitest";

import { FakeLessonMediaStore, FakeObjectStorage } from "../test/media-fakes";
import {
  InvalidMediaKeyError,
  LessonMediaMissingError,
  LessonNotFoundError,
  MediaNotUploadedError,
  MediaTooLargeError,
  UnsupportedMediaError,
} from "./errors";
import { createMediaService, PLAYBACK_TTL_SECONDS, UPLOAD_TTL_SECONDS, type MediaService } from "./service";

const SCHOOL = "school-1";
const NOW = new Date("2026-10-19T00:00:00Z");
const PREFIX = `schools/${SCHOOL}/lessons/video-1/`;
const KEY = `${PREFIX}file-1.mp4`;
const MP4 = { contentType: "video/mp4", sizeBytes: 50_000_000 };

/**
 * The test's fixed time.
 *
 * @returns `NOW`.
 */
function now() {
  return NOW;
}

/**
 * The test's fixed file id.
 *
 * @returns "file-1".
 */
function newId() {
  return "file-1";
}

let lessons: FakeLessonMediaStore;
let storage: FakeObjectStorage;
let media: MediaService;

beforeEach(() => {
  lessons = new FakeLessonMediaStore();
  lessons.lessons.set("video-1", { id: "video-1", type: "video", mediaKey: null });
  lessons.lessons.set("pdf-1", { id: "pdf-1", type: "pdf", mediaKey: null });
  lessons.lessons.set("text-1", { id: "text-1", type: "text", mediaKey: null });
  storage = new FakeObjectStorage();
  media = createMediaService({ schoolId: SCHOOL, lessons, storage, clock: { now }, newId });
});

describe("requestUpload", () => {
  it("presigns an upload under the school's and lesson's prefix", async () => {
    const upload = await media.requestUpload("video-1", MP4);

    expect(upload).toEqual({
      key: KEY,
      url: `https://storage.test/${KEY}?upload&expires=${UPLOAD_TTL_SECONDS}`,
      headers: { "content-type": "video/mp4", "content-length": "50000000" },
      expiresAt: new Date(NOW.getTime() + UPLOAD_TTL_SECONDS * 1000),
    });
  });

  it("stores a PDF for a PDF lesson with its extension", async () => {
    const upload = await media.requestUpload("pdf-1", { contentType: "application/pdf", sizeBytes: 1000 });

    expect(upload.key).toBe(`schools/${SCHOOL}/lessons/pdf-1/file-1.pdf`);
  });

  it.each([
    ["a PDF for a video lesson", "video-1", "application/pdf"],
    ["a video for a PDF lesson", "pdf-1", "video/mp4"],
    ["any file for a text lesson", "text-1", "video/mp4"],
    ["an unknown type", "video-1", "video/x-matroska"],
  ])("throws UnsupportedMediaError for %s", async (_case, lessonId, contentType) => {
    await expect(media.requestUpload(lessonId, { contentType, sizeBytes: 10 })).rejects.toThrow(UnsupportedMediaError);
  });

  it("throws MediaTooLargeError just over the limit and accepts the limit itself", async () => {
    const limit = 100 * 1024 * 1024;

    await expect(media.requestUpload("pdf-1", { contentType: "application/pdf", sizeBytes: limit })).resolves.toBeDefined();
    await expect(media.requestUpload("pdf-1", { contentType: "application/pdf", sizeBytes: limit + 1 })).rejects.toThrow(
      MediaTooLargeError,
    );
  });

  it("throws LessonNotFoundError for another school's or a missing lesson", async () => {
    await expect(media.requestUpload("missing", MP4)).rejects.toThrow(LessonNotFoundError);
  });
});

describe("attachMedia", () => {
  it("attaches an uploaded file to the lesson", async () => {
    storage.uploaded.add(KEY);

    await media.attachMedia("video-1", KEY);

    expect(lessons.lessons.get("video-1")?.mediaKey).toBe(KEY);
  });

  it.each([
    ["another lesson's key", `schools/${SCHOOL}/lessons/pdf-1/file-1.pdf`],
    ["another school's key", "schools/school-2/lessons/video-1/file-1.mp4"],
    ["a key that climbs out of the prefix", `${PREFIX}../pdf-1/file-1.pdf`],
  ])("throws InvalidMediaKeyError for %s", async (_case, key) => {
    storage.uploaded.add(key);

    await expect(media.attachMedia("video-1", key)).rejects.toThrow(InvalidMediaKeyError);
    expect(lessons.lessons.get("video-1")?.mediaKey).toBeNull();
  });

  it("throws MediaNotUploadedError before the upload finished", async () => {
    await expect(media.attachMedia("video-1", KEY)).rejects.toThrow(MediaNotUploadedError);
  });

  it("throws LessonNotFoundError for a missing lesson", async () => {
    await expect(media.attachMedia("missing", KEY)).rejects.toThrow(LessonNotFoundError);
  });
});

describe("getPlaybackUrl", () => {
  it("signs a download of the attached file", async () => {
    storage.uploaded.add(KEY);
    await media.attachMedia("video-1", KEY);

    expect(await media.getPlaybackUrl("video-1")).toEqual({
      url: `https://storage.test/${KEY}?download&expires=${PLAYBACK_TTL_SECONDS}`,
      expiresAt: new Date(NOW.getTime() + PLAYBACK_TTL_SECONDS * 1000),
    });
  });

  it("throws LessonMediaMissingError when nothing is attached", async () => {
    await expect(media.getPlaybackUrl("video-1")).rejects.toThrow(LessonMediaMissingError);
  });

  it("throws LessonNotFoundError for a missing lesson", async () => {
    await expect(media.getPlaybackUrl("missing")).rejects.toThrow(LessonNotFoundError);
  });
});
