// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { onApi, problem, requestTo } from "@/test/api";
import { RedirectError } from "@/test/navigation";
import { revalidatePath } from "@/test/cache";
import { formData as form } from "@/test/form";
import { signIn } from "@/test/session";

import { completeLesson, deleteLessonComment, postLessonComment, saveVideoPosition, submitQuizAnswers } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));
vi.mock("next/cache", () => import("@/test/cache"));

const LESSON_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a02";
const ROUTE = `PUT /schools/by-subdomain/angkor/lessons/${LESSON_ID}/progress`;
const NO_CONTENT = new Response(null, { status: 204 });

beforeEach(() => {
  signIn();
});

describe("saveVideoPosition", () => {
  it("sends the heartbeat's position", async () => {
    onApi(ROUTE, NO_CONTENT);

    await saveVideoPosition("angkor", LESSON_ID, 42);

    expect(await requestTo(ROUTE)?.json()).toEqual({ positionSeconds: 42 });
  });

  it("refuses a position that is not whole seconds, without calling the API", async () => {
    await expect(saveVideoPosition("angkor", LESSON_ID, 1.5)).rejects.toBeInstanceOf(ZodError);
    expect(requestTo(ROUTE)).toBeUndefined();
  });

  it("throws when the API refuses", async () => {
    onApi(ROUTE, problem(403));

    await expect(saveVideoPosition("angkor", LESSON_ID, 42)).rejects.toThrow("API answered 403");
  });
});

describe("completeLesson", () => {
  it("marks the lesson completed and goes to the next page", async () => {
    onApi(ROUTE, NO_CONTENT);

    await expect(completeLesson("angkor", LESSON_ID, "/s/angkor/learn/brand/next")).rejects.toEqual(new RedirectError("/s/angkor/learn/brand/next"));
    expect(await requestTo(ROUTE)?.json()).toEqual({ completed: true });
  });

  it("never follows a next page off the site", async () => {
    onApi(ROUTE, NO_CONTENT);

    await expect(completeLesson("angkor", LESSON_ID, "//evil.example")).rejects.toEqual(new RedirectError("/"));
  });

  it("stays on the lesson when the API fails", async () => {
    onApi(ROUTE, problem(500));

    await expect(completeLesson("angkor", LESSON_ID, "/s/angkor/my-courses")).rejects.toThrow("API answered 500");
  });
});

describe("submitQuizAnswers", () => {
  const ATTEMPTS = `POST /schools/by-subdomain/angkor/lessons/${LESSON_ID}/quiz/attempts`;
  const ANSWERS = [{ questionId: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a61", optionIds: ["6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a62"] }];

  it("sends the answers and returns the grade", async () => {
    const result = { scorePercent: 100, isPassed: true, questions: [{ questionId: ANSWERS[0]?.questionId, isCorrect: true }] };
    onApi(ATTEMPTS, Response.json({ result }, { status: 201 }));

    expect(await submitQuizAnswers("angkor", LESSON_ID, ANSWERS)).toEqual(result);
    expect(await requestTo(ATTEMPTS)?.json()).toEqual({ answers: ANSWERS });
  });

  it("refuses malformed answers without calling the API", async () => {
    await expect(submitQuizAnswers("angkor", LESSON_ID, [{ questionId: "q", optionIds: [] }])).rejects.toBeInstanceOf(ZodError);
    expect(requestTo(ATTEMPTS)).toBeUndefined();
  });

  it("fails loudly when the student lost access", async () => {
    onApi(ATTEMPTS, problem(403, "urn:reanit:problem:not-enrolled"));

    await expect(submitQuizAnswers("angkor", LESSON_ID, ANSWERS)).rejects.toThrow();
  });
});

describe("lesson comments", () => {
  const COMMENTS = `POST /schools/by-subdomain/angkor/lessons/${LESSON_ID}/comments`;
  const LESSON_PATH = `/s/angkor/learn/brand/${LESSON_ID}`;
  const THREAD_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a71";

  it("posts a reply to a thread and refreshes the lesson", async () => {
    onApi(COMMENTS, Response.json({ comment: {} }, { status: 201 }));

    expect(await postLessonComment("angkor", LESSON_ID, LESSON_PATH, { status: "idle" }, form({ body: " Me too ", parentId: THREAD_ID }))).toEqual({ status: "posted" });
    expect(await requestTo(COMMENTS)?.json()).toEqual({ body: "Me too", parentId: THREAD_ID });
    expect(revalidatePath).toHaveBeenCalledWith(LESSON_PATH);
  });

  it("refuses a blank comment without calling the API", async () => {
    expect(await postLessonComment("angkor", LESSON_ID, LESSON_PATH, { status: "idle" }, form({ body: "  " }))).toEqual({ status: "invalid" });
    expect(requestTo(COMMENTS)).toBeUndefined();
  });

  it("deletes the student's comment and refreshes the lesson", async () => {
    const route = `DELETE /schools/by-subdomain/angkor/comments/${THREAD_ID}`;
    onApi(route, new Response(null, { status: 204 }));

    await deleteLessonComment("angkor", LESSON_PATH, THREAD_ID);

    expect(requestTo(route)).toBeDefined();
    expect(revalidatePath).toHaveBeenCalledWith(LESSON_PATH);
  });
});
