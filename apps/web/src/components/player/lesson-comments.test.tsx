import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CommentFormState } from "@/app/[locale]/s/[school]/learn/actions";
import { COMMENT_THREAD } from "@/test/player";
import { renderWithIntl } from "@/test/render";

import { LessonComments } from "./lesson-comments";

const STUDENT = COMMENT_THREAD.author?.id ?? "";

/**
 * Renders the comments section with actions that answer as given.
 *
 * @param posted - What posting returns.
 * @param userId - The signed-in student.
 * @returns The user-event instance and the action spies.
 */
async function setup(posted: CommentFormState = { status: "posted" }, userId = STUDENT) {
  const user = userEvent.setup();
  const post = vi.fn<(state: CommentFormState, formData: FormData) => Promise<CommentFormState>>().mockResolvedValue(posted);
  const remove = vi.fn<(commentId: string) => Promise<void>>().mockResolvedValue(undefined);
  renderWithIntl(<LessonComments threads={[COMMENT_THREAD]} userId={userId} actions={{ post, remove }} />);
  await screen.findByRole("heading", { name: "Questions and comments" });
  return { user, post, remove };
}

describe("LessonComments", () => {
  it("shows each thread with its replies, marking the instructor's", async () => {
    await setup();

    const [question, answer] = screen.getAllByRole("article");
    expect(question).toHaveTextContent("Dara");
    expect(question).toHaveTextContent("Where is the workbook?");
    expect(within(answer as HTMLElement).getByText("Instructor")).toBeInTheDocument();
  });

  it("posts a new comment", async () => {
    const { user, post } = await setup();

    await user.type(screen.getByRole("textbox", { name: "Ask a question or leave a comment" }), "Is there a certificate?");
    await user.click(screen.getByRole("button", { name: "Post" }));

    const formData = post.mock.calls[0]?.[1];
    expect(formData?.get("body")).toBe("Is there a certificate?");
    expect(formData?.get("parentId")).toBeNull();
  });

  it("replies to a thread with its id", async () => {
    const { user, post } = await setup();

    await user.type(screen.getByRole("textbox", { name: "Reply to Dara" }), "Me too");
    await user.click(screen.getByRole("button", { name: "Reply" }));

    expect(post.mock.calls[0]?.[1].get("parentId")).toBe(COMMENT_THREAD.id);
  });

  it("says a comment was too long or blank", async () => {
    const { user } = await setup({ status: "invalid" });

    await user.type(screen.getByRole("textbox", { name: "Ask a question or leave a comment" }), "x");
    await user.click(screen.getByRole("button", { name: "Post" }));

    expect(await screen.findByText("Write up to 2000 characters.")).toBeInTheDocument();
  });

  it("offers to delete only the student's own comments", async () => {
    const { user, remove } = await setup();

    const deletes = screen.getAllByRole("button", { name: "Delete your comment" });
    expect(deletes).toHaveLength(1);
    await user.click(deletes[0] as HTMLElement);

    // A form action also receives the form's data after the bound arguments.
    expect(remove.mock.calls[0]?.[0]).toBe(COMMENT_THREAD.id);
  });

  it("says when nobody has commented yet", async () => {
    renderWithIntl(<LessonComments threads={[]} userId={STUDENT} actions={{ post: vi.fn(), remove: vi.fn() }} />);

    expect(await screen.findByText("No comments yet. Be the first to ask.")).toBeInTheDocument();
  });
});
