import type { MediaService } from "@reanit/core/media";

/** Injection token for `MediaForSchool`. */
export const MEDIA_FOR_SCHOOL = Symbol("MEDIA_FOR_SCHOOL");

/** Builds one school's media service on the tenant client. */
export type MediaForSchool = (schoolId: string) => MediaService;
