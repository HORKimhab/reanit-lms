// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { revalidatePath } from "@/test/cache";
import { formData as form } from "@/test/form";
import { NotFoundError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { replyToComment, setCommentHidden } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next/cache", () => import("@/test/cache"));

const COMMENT_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a71";

beforeEach(() => {
  signIn();
});

describe("replyToComment", () => {
  it("replies and refreshes the inbox", async () => {
    onApi(`POST /comments/${COMMENT_ID}/replies`, Response.json({ comment: {} }, { status: 201 }));

    expect(await replyToComment(COMMENT_ID, { status: "idle" }, form({ body: " Under lesson two " }))).toEqual({ status: "posted" });
    expect(await requestTo(`POST /comments/${COMMENT_ID}/replies`)?.json()).toEqual({ body: "Under lesson two" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/comments");
  });

  it("refuses a blank reply without calling the API", async () => {
    expect(await replyToComment(COMMENT_ID, { status: "idle" }, form({ body: "" }))).toEqual({ status: "invalid" });
    expect(requestTo(`POST /comments/${COMMENT_ID}/replies`)).toBeUndefined();
  });
});

describe("setCommentHidden", () => {
  it("hides the comment and refreshes the inbox", async () => {
    onApi(`PATCH /comments/${COMMENT_ID}`, new Response(null, { status: 204 }));

    await setCommentHidden(COMMENT_ID, true);

    expect(await requestTo(`PATCH /comments/${COMMENT_ID}`)?.json()).toEqual({ isHidden: true });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/comments");
  });

  it("404s on a comment that is gone", async () => {
    onApi(`PATCH /comments/${COMMENT_ID}`, problem(404, "urn:reanit:problem:comment-not-found"));

    await expect(setCommentHidden(COMMENT_ID, true)).rejects.toBeInstanceOf(NotFoundError);
  });
});
