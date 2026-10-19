import type { InboxPage } from "@reanit/core/learning";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { COMMENT_THREAD } from "@/test/player";
import { renderWithIntl } from "@/test/render";

import { CommentInbox, type CommentInboxActions } from "./comment-inbox";

const PAGE: InboxPage = {
  threads: [{ ...COMMENT_THREAD, replies: [], lesson: { id: COMMENT_THREAD.lessonId, title: "Welcome" }, course: { slug: "brand", title: "Brand Basics" }, isAnswered: false }],
  total: 21,
  page: 1,
  pageSize: 20,
};

/**
 * Renders the inbox with spies for its actions.
 *
 * @param result - The page to show.
 * @param filter - Which threads it holds.
 * @returns The user-event instance and the spies.
 */
async function setup(result: InboxPage = PAGE, filter: "unanswered" | "all" = "unanswered") {
  const user = userEvent.setup();
  const actions = {
    reply: vi.fn<CommentInboxActions["reply"]>().mockResolvedValue({ status: "posted" }),
    setHidden: vi.fn<CommentInboxActions["setHidden"]>().mockResolvedValue(undefined),
  };
  renderWithIntl(<CommentInbox result={result} filter={filter} actions={actions} />);
  await screen.findByRole("navigation", { name: "Show" });
  return { user, actions };
}

describe("CommentInbox", () => {
  it("shows where each question was asked and links to the other filter and page", async () => {
    await setup();

    expect(screen.getByText("Brand Basics · Welcome")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Unanswered" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/dashboard/comments?filter=all");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/dashboard/comments?filter=unanswered&page=2");
  });

  it("replies to the thread", async () => {
    const { user, actions } = await setup();

    await user.type(screen.getByRole("textbox", { name: "Reply to Dara" }), "Under lesson two");
    await user.click(screen.getByRole("button", { name: "Reply" }));

    expect(actions.reply.mock.calls[0]?.[0]).toBe(COMMENT_THREAD.id);
    expect(actions.reply.mock.calls[0]?.[2].get("body")).toBe("Under lesson two");
  });

  it("hides a visible comment and shows a hidden one", async () => {
    const hidden = { ...PAGE, threads: [{ ...PAGE.threads[0]!, isHidden: true }] };
    const { user, actions } = await setup(hidden, "all");

    await user.click(screen.getByRole("button", { name: "Show to students" }));

    // A form action also receives the form's data after the bound arguments.
    expect(actions.setHidden.mock.calls[0]?.slice(0, 2)).toEqual([COMMENT_THREAD.id, false]);
  });

  it.each([
    ["unanswered", "You're all caught up"],
    ["all", "No comments yet"],
  ] as const)("shows an empty state for no %s threads", async (filter, title) => {
    await setup({ ...PAGE, threads: [], total: 0 }, filter);

    expect(screen.getByText(title)).toBeInTheDocument();
  });
});
