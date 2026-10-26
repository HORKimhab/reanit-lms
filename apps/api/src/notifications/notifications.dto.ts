import { notificationPreferencesSchema, unsubscribeSchema } from "@reanit/core/notifications";
import { z } from "zod";

import { createZodDto } from "../http/zod-dto";

/** `PUT /notifications/preferences` body: each staff email on or off, and their language. */
export class NotificationPreferencesBody extends createZodDto(notificationPreferencesSchema) {}

/** `POST /notifications/unsubscribe` body: the token and kind from an unsubscribe link. */
export class UnsubscribeBody extends createZodDto(unsubscribeSchema) {}

/** The caller's email settings for their school. */
export class NotificationPreferencesResponse extends createZodDto(z.object({ preferences: notificationPreferencesSchema })) {}

/** The school whose emails were stopped. */
export class UnsubscribeResponse extends createZodDto(z.object({ schoolName: z.string() })) {}
