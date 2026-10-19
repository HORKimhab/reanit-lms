import { MediaTooLargeError, UnsupportedMediaError } from "@reanit/core/media";
import { NotSchoolStaffError } from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { TEST_SCHOOL, useStaffApp } from "../test/session";

const LESSON_ID = "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a99";
const BASE_URL = `/lessons/${LESSON_ID}/media`;
const EXPIRES_AT = new Date("2026-10-19T01:00:00Z");

const staff = useStaffApp();

describe("POST /lessons/:lessonId/media/uploads", () => {
  it("presigns the upload in the caller's school", async () => {
    staff.clients.media.requestUpload.mockResolvedValue({ key: "k", url: "https://storage.test/k", headers: { "content-type": "video/mp4" }, expiresAt: EXPIRES_AT });

    const response = await staff.app.inject({
      method: "POST",
      url: `${BASE_URL}/uploads`,
      headers: staff.headers,
      payload: { contentType: "Video/MP4", sizeBytes: 1000 },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ key: "k", url: "https://storage.test/k", headers: { "content-type": "video/mp4" }, expiresAt: EXPIRES_AT.toISOString() });
    expect(staff.clients.mediaFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(staff.clients.media.requestUpload).toHaveBeenCalledWith(LESSON_ID, { contentType: "video/mp4", sizeBytes: 1000 });
  });

  it.each([
    [new UnsupportedMediaError(), 415, "unsupported-media"],
    [new MediaTooLargeError(), 413, "media-too-large"],
  ])("answers %s with %i", async (error, status, code) => {
    staff.clients.media.requestUpload.mockRejectedValue(error);

    const response = await staff.app.inject({ method: "POST", url: `${BASE_URL}/uploads`, headers: staff.headers, payload: { contentType: "video/mp4", sizeBytes: 1 } });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ type: `urn:reanit:problem:${code}` });
  });

  it("answers 400 for a size that is not a positive whole number", async () => {
    const response = await staff.app.inject({ method: "POST", url: `${BASE_URL}/uploads`, headers: staff.headers, payload: { contentType: "video/mp4", sizeBytes: 0 } });

    expect(response.statusCode).toBe(400);
    expect(staff.clients.media.requestUpload).not.toHaveBeenCalled();
  });
});

describe("PUT /lessons/:lessonId/media", () => {
  it("attaches the uploaded file", async () => {
    const response = await staff.app.inject({ method: "PUT", url: BASE_URL, headers: staff.headers, payload: { key: "schools/s/lessons/l/f.mp4" } });

    expect(response.statusCode).toBe(204);
    expect(staff.clients.media.attachMedia).toHaveBeenCalledWith(LESSON_ID, "schools/s/lessons/l/f.mp4");
  });
});

describe("GET /lessons/:lessonId/media", () => {
  it("returns a signed playback URL", async () => {
    staff.clients.media.getPlaybackUrl.mockResolvedValue({ url: "https://storage.test/k?signed", expiresAt: EXPIRES_AT });

    const response = await staff.app.inject({ method: "GET", url: BASE_URL, headers: staff.headers });

    expect(response.json()).toEqual({ url: "https://storage.test/k?signed", expiresAt: EXPIRES_AT.toISOString() });
  });
});

describe("access", () => {
  it("answers 401 to a signed-out caller and 403 to a user who runs no school", async () => {
    expect((await staff.app.inject({ method: "GET", url: BASE_URL })).statusCode).toBe(401);
    staff.clients.schools.getStaffSchool.mockRejectedValue(new NotSchoolStaffError());

    expect((await staff.app.inject({ method: "GET", url: BASE_URL, headers: staff.headers })).statusCode).toBe(403);
    expect(staff.clients.mediaFor).not.toHaveBeenCalled();
  });

  it("answers 400 for a lesson id that is not a UUID", async () => {
    expect((await staff.app.inject({ method: "GET", url: "/lessons/nope/media", headers: staff.headers })).statusCode).toBe(400);
  });
});
