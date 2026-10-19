"use client";

import { MAX_QUESTION_OPTIONS, OPTION_MAX_LENGTH, PROMPT_MAX_LENGTH, QUESTION_KINDS, type Quiz } from "@reanit/core/learning";
import { Button } from "@reanit/ui/components/button";
import { cn } from "@reanit/ui/lib/utils";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useReducer, useState, useTransition, type Dispatch } from "react";

import type { CourseFormState } from "@/app/[locale]/dashboard/courses/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";

import { quizReducer, type QuizAction } from "./quiz-reducer";
import { RemoveButton } from "./remove-button";

/** Fewest answers a question keeps; the remove button hides below it. */
const MIN_OPTIONS = 2;

/**
 * Edits a quiz lesson: its pass mark and questions, each with its answers and which are right, then
 * saves the whole quiz at once.
 *
 * @param props - Component props.
 * @param props.initial - The quiz as last saved.
 * @param props.save - Saves the quiz; bound to the lesson.
 * @returns The editor with its save button and result.
 */
export function QuizEditor({ initial, save }: { initial: Quiz; save: (quiz: Quiz) => Promise<CourseFormState> }) {
  const t = useTranslations("Quiz");
  const [quiz, dispatch] = useReducer(quizReducer, initial);
  const [result, setResult] = useState<CourseFormState["status"]>("idle");
  const [isSaving, startSaving] = useTransition();

  /** Saves the quiz as it is now and shows the result. */
  function submit() {
    startSaving(async () => setResult((await save(quiz)).status));
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Field label={t("passPercent")} hint={t("passPercentHint")}>
        {(control) => (
          <input
            {...control}
            type="number"
            min={1}
            max={100}
            value={quiz.passPercent}
            onChange={(event) => dispatch({ type: "setPassPercent", passPercent: event.target.valueAsNumber })}
            className={cn(INPUT_CLASS, "w-28")}
          />
        )}
      </Field>
      {quiz.questions.length === 0 ? <p className="text-sm text-muted-foreground">{t("noQuestions")}</p> : null}
      <ol className="flex flex-col gap-4">
        {quiz.questions.map((question, index) => (
          <QuestionEditor key={question.id} question={question} n={index + 1} dispatch={dispatch} />
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => dispatch({ type: "addQuestion", questionId: crypto.randomUUID(), optionIds: [crypto.randomUUID(), crypto.randomUUID()] })}
      >
        <Plus aria-hidden />
        {t("addQuestion")}
      </Button>
      <div className="flex items-center gap-3 border-t pt-4">
        <Button type="button" onClick={submit} disabled={isSaving}>
          {isSaving ? t("saving") : t("save")}
        </Button>
        <p role="status" className={cn("text-sm text-muted-foreground", result === "invalid" && "text-destructive")}>
          {isSaving ? null : result === "saved" ? t("saved") : result === "invalid" ? t("invalid") : null}
        </p>
      </div>
    </div>
  );
}

/**
 * One question in the editor: its text, how it is answered, and its answers with which are right.
 *
 * @param props - Component props.
 * @param props.question - The question.
 * @param props.n - Its number, from 1.
 * @param props.dispatch - Sends edits to the quiz.
 * @returns The question card.
 */
function QuestionEditor({ question, n, dispatch }: { question: Quiz["questions"][number]; n: number; dispatch: Dispatch<QuizAction> }) {
  const t = useTranslations("Quiz");
  const questionId = question.id;

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Field label={t("prompt", { n })}>
            {(control) => (
              <textarea
                {...control}
                value={question.prompt}
                maxLength={PROMPT_MAX_LENGTH}
                rows={2}
                onChange={(event) => dispatch({ type: "setPrompt", questionId, prompt: event.target.value })}
                className={cn(INPUT_CLASS, "h-auto py-2")}
              />
            )}
          </Field>
        </div>
        <RemoveButton label={t("removeQuestion", { n })} onClick={() => dispatch({ type: "removeQuestion", questionId })} />
      </div>
      <select
        aria-label={t("kind", { n })}
        value={question.kind}
        onChange={(event) => dispatch({ type: "setKind", questionId, kind: event.target.value as (typeof QUESTION_KINDS)[number] })}
        className={cn(INPUT_CLASS, "self-start")}
      >
        {QUESTION_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(`kinds.${kind}`)}
          </option>
        ))}
      </select>
      <ul className="flex flex-col gap-2">
        {question.options.map((option, index) => (
          <li key={option.id} className="flex items-center gap-2">
            <input
              type={question.kind === "single" ? "radio" : "checkbox"}
              name={`correct-${questionId}`}
              aria-label={t("isCorrect", { n: index + 1, question: n })}
              checked={option.isCorrect}
              onChange={() => dispatch({ type: "toggleCorrect", questionId, optionId: option.id })}
              className="size-4 accent-primary"
            />
            <input
              aria-label={t("option", { n: index + 1, question: n })}
              value={option.text}
              maxLength={OPTION_MAX_LENGTH}
              onChange={(event) => dispatch({ type: "setOptionText", questionId, optionId: option.id, text: event.target.value })}
              className={cn(INPUT_CLASS, "flex-1")}
            />
            {question.options.length > MIN_OPTIONS ? (
              <RemoveButton
                label={t("removeOption", { n: index + 1, question: n })}
                onClick={() => dispatch({ type: "removeOption", questionId, optionId: option.id })}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {question.options.length < MAX_QUESTION_OPTIONS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => dispatch({ type: "addOption", questionId, optionId: crypto.randomUUID() })}
        >
          <Plus aria-hidden />
          {t("addOption", { n })}
        </Button>
      ) : null}
    </li>
  );
}
