import type { Quiz } from "@reanit/core/learning";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CourseFormState } from "@/app/[locale]/dashboard/courses/actions";
import { renderWithIntl } from "@/test/render";

import { QuizEditor } from "./quiz-editor";

const EMPTY: Quiz = { passPercent: 70, questions: [] };

/**
 * Renders the editor with a save that answers as given.
 *
 * @param initial - The quiz as last saved.
 * @param status - What saving returns.
 * @returns The user-event instance and the save spy.
 */
function setup(initial: Quiz = EMPTY, status: CourseFormState["status"] = "saved") {
  const user = userEvent.setup();
  const save = vi.fn<(quiz: Quiz) => Promise<CourseFormState>>().mockResolvedValue({ status, invalidFields: [] });
  renderWithIntl(<QuizEditor initial={initial} save={save} />);
  return { user, save };
}

describe("QuizEditor", () => {
  it("builds a question with its right answer and saves the whole quiz", async () => {
    const { user, save } = setup();

    expect(await screen.findByText("Add the first question.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add question" }));
    await user.type(screen.getByRole("textbox", { name: "Question 1" }), "Which is primary?");
    await user.type(screen.getByRole("textbox", { name: "Answer 1 of question 1" }), "Green");
    await user.type(screen.getByRole("textbox", { name: "Answer 2 of question 1" }), "Red");
    await user.click(screen.getByRole("radio", { name: "Answer 2 of question 1 is right" }));
    await user.clear(screen.getByRole("spinbutton", { name: "Pass mark (%)" }));
    await user.type(screen.getByRole("spinbutton", { name: "Pass mark (%)" }), "80");
    await user.click(screen.getByRole("button", { name: "Save quiz" }));

    expect(await screen.findByText("Quiz saved.")).toBeInTheDocument();
    const [quiz] = save.mock.calls[0] ?? [];
    expect(quiz?.passPercent).toBe(80);
    expect(quiz?.questions[0]).toMatchObject({
      prompt: "Which is primary?",
      kind: "single",
      options: [
        { text: "Green", isCorrect: false },
        { text: "Red", isCorrect: true },
      ],
    });
  });

  it("offers checkboxes for a several-answers question, and removes answers down to two", async () => {
    const { user } = setup();

    await user.click(await screen.findByRole("button", { name: "Add question" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Answers to question 1" }), "Several right answers");
    await user.click(screen.getByRole("button", { name: "Add answer to question 1" }));

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Remove answer 3 of question 1" }));
    expect(screen.queryByRole("button", { name: /Remove answer/ })).not.toBeInTheDocument();
  });

  it("says what is missing when the quiz does not save", async () => {
    const { user } = setup(EMPTY, "invalid");

    await user.click(await screen.findByRole("button", { name: "Save quiz" }));

    expect(await screen.findByText("Each question needs text, at least two answers and its right answer marked.")).toBeInTheDocument();
  });

  it("removes a question", async () => {
    const { user } = setup();

    await user.click(await screen.findByRole("button", { name: "Add question" }));
    await user.click(screen.getByRole("button", { name: "Remove question 1" }));

    expect(screen.getByText("Add the first question.")).toBeInTheDocument();
  });
});
