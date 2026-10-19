import type { Quiz, QuizAttemptSummary, StudentQuiz } from "@reanit/core/learning";

import { getApi } from "../api";
import { checkStaffResponse } from "../schools/staff";
import { checkStudentResponse } from "../schools/student";

/** A quiz as its student takes it, with their last attempt (its time as an ISO date). */
export type StudentQuizView = StudentQuiz & { lastAttempt: (Omit<QuizAttemptSummary, "at"> & { at: string }) | null };

/**
 * Loads a quiz lesson with its right answers, for the quiz editor.
 *
 * @param lessonId The lesson, from the URL.
 * @returns The quiz; one never saved has no questions.
 * @throws {Error} Next's not-found signal when the lesson is not one of the school's quizzes, a redirect signal, or an unexpected-response error.
 */
export async function getStaffQuiz(lessonId: string): Promise<Quiz> {
  const { data, response } = await (await getApi()).GET("/lessons/{lessonId}/quiz", { params: { path: { lessonId } } });
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the quiz.
  return data!.quiz;
}

/**
 * Loads a quiz for its enrolled student, without the right answers.
 *
 * @param subdomain The school's subdomain.
 * @param lessonId The quiz lesson.
 * @param returnPath Where a signed-out student comes back to after logging in.
 * @returns The quiz with the student's last attempt, or null while it has no questions.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function getStudentQuiz(subdomain: string, lessonId: string, returnPath: string): Promise<StudentQuizView | null> {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/lessons/{lessonId}/quiz", {
    params: { path: { subdomain, lessonId } },
  });
  if (response.status === 404) return null;
  checkStudentResponse(response, returnPath);
  // checkStudentResponse returned, so the API answered 2xx with the quiz.
  return data!.quiz;
}
