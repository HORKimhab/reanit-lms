import type { QuizAnswers, QuizResult } from "@reanit/core/learning";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { router } from "@/test/navigation";
import { STUDENT_QUIZ } from "@/test/player";
import { renderWithIntl } from "@/test/render";

import { QuizPlayer } from "./quiz-player";

const [QUESTION] = STUDENT_QUIZ.questions;
const [RED] = QUESTION?.options ?? [];

/**
 * Renders the quiz with a grader that answers as given.
 *
 * @param result - What grading returns.
 * @param locale - UI locale.
 * @returns The user-event instance and the grader spy.
 */
function setup(result: QuizResult, locale: "en" | "km" = "en") {
  const user = userEvent.setup();
  const submit = vi.fn<(answers: QuizAnswers) => Promise<QuizResult>>().mockResolvedValue(result);
  renderWithIntl(<QuizPlayer quiz={STUDENT_QUIZ} submit={submit} />, { locale });
  return { user, submit };
}

const PASSED: QuizResult = { scorePercent: 100, isPassed: true, questions: [{ questionId: QUESTION?.id ?? "", isCorrect: true }] };
const FAILED: QuizResult = { scorePercent: 0, isPassed: false, questions: [{ questionId: QUESTION?.id ?? "", isCorrect: false }] };

describe("QuizPlayer", () => {
  it("sends the picked options, says the student passed, and refreshes the lesson", async () => {
    const { user, submit } = setup(PASSED);

    await user.click(await screen.findByRole("radio", { name: "Red" }));
    await user.click(screen.getByRole("button", { name: "Check answers" }));

    expect(await screen.findByRole("status")).toHaveTextContent("You passed with 100%.");
    expect(submit).toHaveBeenCalledWith([{ questionId: QUESTION?.id, optionIds: [RED?.id] }]);
    expect(screen.getByText("Right")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("marks wrong questions after a failed try and offers another with cleared answers", async () => {
    const { user } = setup(FAILED);

    await user.click(await screen.findByRole("radio", { name: "Green" }));
    await user.click(screen.getByRole("button", { name: "Check answers" }));

    expect(await screen.findByRole("status")).toHaveTextContent("You scored 0%. You need 100% to pass.");
    expect(screen.getByText("Wrong")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Green" })).toBeDisabled();
    expect(router.refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByRole("radio", { name: "Green" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Check answers" })).toBeEnabled();
  });

  it("shows the student's last score before they try again", async () => {
    renderWithIntl(<QuizPlayer quiz={{ ...STUDENT_QUIZ, lastAttempt: { scorePercent: 50, isPassed: false, at: "2026-10-20T01:00:00.000Z" } }} submit={vi.fn()} />);

    expect(await screen.findByText("Your last attempt: 50%")).toBeInTheDocument();
    expect(screen.getByText("1 question · pass with 100%")).toBeInTheDocument();
  });

  it("says a quiz without questions is not ready", async () => {
    renderWithIntl(<QuizPlayer quiz={null} submit={vi.fn()} />);

    expect(await screen.findByText("This quiz has no questions yet.")).toBeInTheDocument();
  });

  it("uses Khmer text when the locale is km", async () => {
    setup(PASSED, "km");

    expect(await screen.findByRole("button", { name: "ពិនិត្យចម្លើយ" })).toBeInTheDocument();
  });
});
