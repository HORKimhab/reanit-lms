// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError } from "@/test/navigation";
import { PLAYER_COURSE } from "@/test/player";

import { getLessonFileUrl, getPlayerCourse } from "./player";

vi.mock("next/headers", () => import("@/test/headers"));

const LESSON_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a02";
const MEDIA_ROUTE = `GET /schools/by-subdomain/angkor/lessons/${LESSON_ID}/media`;

describe("getPlayerCourse", () => {
  it("loads the course with the student's progress", async () => {
    onApi("GET /schools/by-subdomain/angkor/learn/brand-design-basics", Response.json({ course: PLAYER_COURSE }));

    expect(await getPlayerCourse("angkor", "brand-design-basics")).toEqual(PLAYER_COURSE);
  });

  it("404s for a student who does not have the course", async () => {
    onApi("GET /schools/by-subdomain/angkor/learn/brand-design-basics", problem(403, "urn:reanit:problem:not-enrolled"));

    await expect(getPlayerCourse("angkor", "brand-design-basics")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getLessonFileUrl", () => {
  it("returns the lesson's signed URL", async () => {
    onApi(MEDIA_ROUTE, Response.json({ url: "https://storage.test/a.mp4", expiresAt: "2026-10-19T04:00:00.000Z" }));

    expect(await getLessonFileUrl("angkor", LESSON_ID, "/s/angkor/learn/brand")).toBe("https://storage.test/a.mp4");
  });

  it("returns null when the lesson has no file yet", async () => {
    onApi(MEDIA_ROUTE, problem(404, "urn:reanit:problem:lesson-media-missing"));

    expect(await getLessonFileUrl("angkor", LESSON_ID, "/s/angkor/learn/brand")).toBeNull();
  });

  it("404s for a lesson the student cannot open", async () => {
    onApi(MEDIA_ROUTE, problem(403, "urn:reanit:problem:not-enrolled"));

    await expect(getLessonFileUrl("angkor", LESSON_ID, "/s/angkor/learn/brand")).rejects.toBeInstanceOf(NotFoundError);
  });
});
