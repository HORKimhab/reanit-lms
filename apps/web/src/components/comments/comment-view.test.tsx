import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { COMMENT_THREAD } from "@/test/player";
import { renderWithIntl } from "@/test/render";

import { CommentView } from "./comment-view";

describe("CommentView", () => {
  it("shows the author, when and what they wrote", async () => {
    renderWithIntl(<CommentView comment={COMMENT_THREAD} />);

    const article = await screen.findByRole("article");
    expect(article).toHaveTextContent("Dara");
    expect(screen.getByText("Oct 20, 2026, 1:00 AM")).toHaveAttribute("datetime", "2026-10-20T01:00:00.000Z");
    expect(article).not.toHaveTextContent("Instructor");
  });

  it("marks a hidden comment and names a deleted or nameless author", async () => {
    renderWithIntl(
      <>
        <CommentView comment={{ ...COMMENT_THREAD, author: null, isHidden: true }} />
        <CommentView comment={{ ...COMMENT_THREAD, author: { id: "u", name: null, isStaff: false } }} />
      </>,
    );

    const [deleted, nameless] = await screen.findAllByRole("article");
    expect(deleted).toHaveTextContent("Deleted account");
    expect(deleted).toHaveTextContent("Hidden");
    expect(nameless).toHaveTextContent("Student");
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<CommentView comment={{ ...COMMENT_THREAD, author: { id: "u", name: "Vanna", isStaff: true } }} />, { locale: "km" });

    expect(await screen.findByText("គ្រូបង្រៀន")).toBeInTheDocument();
  });
});
