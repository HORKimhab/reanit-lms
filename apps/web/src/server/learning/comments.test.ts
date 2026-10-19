// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { RedirectError } from "@/test/navigation";
import { COMMENT_THREAD } from "@/test/player";
import { signIn } from "@/test/session";

import { getCommentInbox, getLessonComments } from "./comments";

vi.mock("next/headers", () => import("@/test/headers"));

/** The test thread as the API sends it, its times as ISO dates. */
const THREAD_JSON = JSON.parse(JSON.stringify(COMMENT_THREAD));
const ROUTE = `GET /schools/by-subdomain/angkor/lessons/${COMMENT_THREAD.lessonId}/comments`;

beforeEach(() => {
  signIn();
});

describe("getLessonComments", () => {
  it("returns the lesson's threads with their times as Dates", async () => {
    onApi(ROUTE, Response.json({ threads: [THREAD_JSON] }));

    expect(await getLessonComments("angkor", COMMENT_THREAD.lessonId, "/s/angkor/learn/brand/l")).toEqual([COMMENT_THREAD]);
  });

  it("sends a signed-out student to log in and back", async () => {
    onApi(ROUTE, problem(401));

    await expect(getLessonComments("angkor", COMMENT_THREAD.lessonId, "/s/angkor/learn/brand/l")).rejects.toEqual(
      new RedirectError("/login?next=%2Fs%2Fangkor%2Flearn%2Fbrand%2Fl"),
    );
  });
});

describe("getCommentInbox", () => {
  it("asks for the page and filter and returns threads with Dates", async () => {
    const thread = { ...THREAD_JSON, lesson: { id: COMMENT_THREAD.lessonId, title: "Welcome" }, course: { slug: "brand", title: "Brand" }, isAnswered: true };
    onApi("GET /comments", Response.json({ threads: [thread], total: 1, page: 2, pageSize: 20 }));

    const page = await getCommentInbox({ page: 2, filter: "all" });

    expect(page.threads[0]?.replies[0]?.createdAt).toEqual(COMMENT_THREAD.replies[0]?.createdAt);
    expect(new URL(requestTo("GET /comments")?.url ?? "").search).toBe("?page=2&filter=all");
  });
});
