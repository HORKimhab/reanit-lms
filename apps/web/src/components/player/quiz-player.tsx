"use client";

import type { QuizAnswers, QuizResult } from "@reanit/core/learning";
import { Button } from "@reanit/ui/components/button";
import { cn } from "@reanit/ui/lib/utils";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { useRouter } from "@/i18n/navigation";
import type { StudentQuizView } from "@/server/learning/quizzes";

/**
 * Reads the options picked for each question from the quiz form.
 *
 * @param quiz - The quiz.
 * @param formData - The submitted form: one field per question, named by its id.
 * @returns The answers.
 */
function answersFrom(quiz: StudentQuizView, formData: FormData): QuizAnswers {
  return quiz.questions.map((question) => ({ questionId: question.id, optionIds: formData.getAll(question.id).map(String) }));
}

/**
 * A quiz lesson as the student takes it: the questions, then the score with each question marked
 * right or wrong. Passing refreshes the page, so the lesson shows as completed; failing offers another try.
 *
 * @param props - Component props.
 * @param props.quiz - The quiz without its right answers, or null while it has no questions.
 * @param props.submit - Grades the answers; bound to the school and lesson.
 * @returns The quiz form or its result, or a notice when it is not ready.
 */
export function QuizPlayer({ quiz, submit }: { quiz: StudentQuizView | null; submit: (answers: QuizAnswers) => Promise<QuizResult> }) {
  const t = useTranslations("Quiz");
  const router = useRouter();
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isChecking, startChecking] = useTransition();

  if (!quiz) return <p className="rounded-xl border p-6 text-muted-foreground">{t("notReady")}</p>;

  /**
   * Grades the form's answers and shows the result.
   *
   * @param formData - The submitted quiz form.
   */
  function check(formData: FormData) {
    if (!quiz) return;
    const answers = answersFrom(quiz, formData);
    startChecking(async () => {
      const graded = await submit(answers);
      setResult(graded);
      if (graded.isPassed) router.refresh();
    });
  }

  /** Clears the result for another try; the form already cleared its answers when it was sent. */
  function retry() {
    setResult(null);
  }

  const isRight = new Map(result?.questions.map((question) => [question.questionId, question.isCorrect]));

  return (
    <form action={check} className="flex flex-col gap-6 rounded-xl border p-6">
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <p>{t("intro", { count: quiz.questions.length, percent: quiz.passPercent })}</p>
        {quiz.lastAttempt && !result ? <p>{t("lastAttempt", { score: quiz.lastAttempt.scorePercent })}</p> : null}
      </div>
      <ol className="flex flex-col gap-5">
        {quiz.questions.map((question) => (
          <li key={question.id}>
            <fieldset disabled={result !== null} className="flex flex-col gap-2">
              <legend className="mb-1 flex items-center gap-2 font-medium">
                {question.prompt}
                {result ? <Mark isCorrect={isRight.get(question.id) ?? false} /> : null}
              </legend>
              {question.options.map((option) => (
                <label key={option.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm has-checked:border-primary">
                  <input type={question.kind === "single" ? "radio" : "checkbox"} name={question.id} value={option.id} className="size-4 accent-primary" />
                  {option.text}
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        {result ? (
          <>
            <p role="status" className={cn("font-medium", result.isPassed ? "text-success" : "text-destructive")}>
              {result.isPassed ? t("passed", { score: result.scorePercent }) : t("failed", { score: result.scorePercent, percent: quiz.passPercent })}
            </p>
            {result.isPassed ? null : (
              <Button type="button" variant="outline" onClick={retry}>
                {t("retry")}
              </Button>
            )}
          </>
        ) : (
          <Button type="submit" disabled={isChecking}>
            {isChecking ? t("checking") : t("submit")}
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Says whether a question was answered right, after grading.
 *
 * @param props - Component props.
 * @param props.isCorrect - Whether it was right.
 * @returns A small labelled mark.
 */
function Mark({ isCorrect }: { isCorrect: boolean }) {
  const t = useTranslations("Quiz");
  const Icon = isCorrect ? Check : X;
  return (
    <span className={cn("flex items-center gap-1 text-xs font-normal", isCorrect ? "text-success" : "text-destructive")}>
      <Icon aria-hidden className="size-3.5" />
      {t(isCorrect ? "correct" : "incorrect")}
    </span>
  );
}
