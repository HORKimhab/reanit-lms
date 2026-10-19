"use server";

import { safeRedirectPath } from "@reanit/core/auth";
import { progressSchema, type ProgressInput } from "@reanit/core/learning";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { getApi, unexpectedResponse } from "@/server/api";

/**
 * Sends progress for a lesson to the API.
 *
 * @param subdomain The school's subdomain.
 * @param lessonId The lesson.
 * @param input Untrusted position and/or completion from the browser.
 * @throws {z.ZodError} When the input is not a valid heartbeat.
 * @throws {Error} When the API refuses or fails.
 */
async function sendProgress(subdomain: string, lessonId: string, input: ProgressInput) {
  const body = progressSchema.parse(input);
  const { response } = await (await getApi()).PUT("/schools/by-subdomain/{subdomain}/lessons/{lessonId}/progress", {
    params: { path: { subdomain, lessonId } },
    body,
  });
  if (!response.ok) throw unexpectedResponse(response);
}

/**
 * The player's heartbeat: saves where the video is. Bind the school and lesson: `saveVideoPosition.bind(null, school, lessonId)`.
 *
 * @param subdomain The school's subdomain.
 * @param lessonId The lesson.
 * @param positionSeconds Untrusted position from the browser, in whole seconds.
 * @throws {z.ZodError} When the position is not a whole number of seconds in range.
 * @throws {Error} When the API refuses or fails.
 */
export async function saveVideoPosition(subdomain: string, lessonId: string, positionSeconds: number) {
  await sendProgress(subdomain, lessonId, { positionSeconds });
}

/**
 * Marks a lesson completed and moves on. Bind the school, lesson and where to go next.
 *
 * @param subdomain The school's subdomain.
 * @param lessonId The lesson.
 * @param nextPath The next lesson, or my courses after the last one; only a local path is followed.
 * @throws {Error} Next's redirect signal on success, or when the API refuses or fails.
 */
export async function completeLesson(subdomain: string, lessonId: string, nextPath: string) {
  await sendProgress(subdomain, lessonId, { completed: true });
  redirect({ href: safeRedirectPath(nextPath), locale: await getLocale() });
}
