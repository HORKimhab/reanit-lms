import { attachMediaSchema, uploadRequestSchema } from "@reanit/core/media";
import { z } from "zod";

import { createZodDto } from "../http/zod-dto";

/** Path of the routes that act on one lesson's file. */
export class LessonParams extends createZodDto(z.object({ lessonId: z.uuid() })) {}

/** `POST /lessons/:lessonId/media/uploads` body: the file the browser is about to send. */
export class UploadRequestBody extends createZodDto(uploadRequestSchema) {}

/** `PUT /lessons/:lessonId/media` body: the key the upload went to. */
export class AttachMediaBody extends createZodDto(attachMediaSchema) {}

/** Where and how to upload the file, and the key to attach afterwards. */
export class UploadResponse extends createZodDto(
  z.object({ key: z.string(), url: z.url(), headers: z.record(z.string(), z.string()), expiresAt: z.iso.datetime() }),
) {}

/** A signed URL to play or download the lesson's file. */
export class PlaybackResponse extends createZodDto(z.object({ url: z.url(), expiresAt: z.iso.datetime() })) {}
