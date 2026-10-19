import { z } from "zod";

import type { LessonType } from "../catalog";

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

/** Files each lesson type accepts, by content type with the file extension stored, and how big they may be. */
export const MEDIA_RULES = {
  video: { contentTypes: { "video/mp4": "mp4", "video/webm": "webm" }, maxBytes: 5 * GIB },
  pdf: { contentTypes: { "application/pdf": "pdf" }, maxBytes: 100 * MIB },
} as const satisfies Partial<Record<LessonType, { contentTypes: Record<string, string>; maxBytes: number }>>;

/** What the browser says about a file before uploading it. */
export const uploadRequestSchema = z.object({
  contentType: z.string().trim().toLowerCase().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});

/** Parsed upload request. */
export type UploadRequest = z.infer<typeof uploadRequestSchema>;

/** Attach request: the key the upload went to. */
export const attachMediaSchema = z.object({ key: z.string().min(1).max(512) });

/**
 * Where a lesson's files live in the bucket; the school is part of it so keys never cross tenants.
 *
 * @param schoolId The school's id.
 * @param lessonId The lesson's id.
 * @returns The key prefix, ending in a slash.
 * @example
 * lessonMediaPrefix(school.id, lesson.id); // "schools/<school>/lessons/<lesson>/"
 */
export function lessonMediaPrefix(schoolId: string, lessonId: string): string {
  return `schools/${schoolId}/lessons/${lessonId}/`;
}

/**
 * Tells whether a lesson type holds an uploaded file (video, PDF) rather than content of its own (text, quiz).
 *
 * @param lessonType The lesson's type.
 * @returns True for the types `MEDIA_RULES` covers.
 * @example
 * holdsMedia("pdf"); // true
 */
export function holdsMedia(lessonType: LessonType): lessonType is keyof typeof MEDIA_RULES {
  return Object.hasOwn(MEDIA_RULES, lessonType);
}

/**
 * Finds the file extension a lesson type stores a content type under.
 *
 * @param lessonType The lesson's type.
 * @param contentType The file's content type.
 * @returns The extension, or undefined when the lesson type does not take that content type.
 * @example
 * mediaExtension("video", "video/mp4"); // "mp4"
 */
export function mediaExtension(lessonType: LessonType, contentType: string): string | undefined {
  if (!holdsMedia(lessonType)) return undefined;
  const types: Record<string, string> = MEDIA_RULES[lessonType].contentTypes;
  return Object.hasOwn(types, contentType) ? types[contentType] : undefined;
}
