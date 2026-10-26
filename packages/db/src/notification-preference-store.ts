import type { DbClient } from "./client";
import type { Prisma } from "./generated/prisma/client";
import { forSchool } from "./tenant";

/** Kinds of staff email; matches `NotificationKind` in `@reanit/core/notifications`, whose names are the settings' columns. */
type NotificationKind = "newSale" | "newComment" | "courseCompleted";
/** Settings as `NotificationPreferences` in `@reanit/core/notifications` has them. */
type Preferences = { newSale: boolean; newComment: boolean; courseCompleted: boolean; locale: "en" | "km" };

/** The settings' columns. */
const PREFERENCE_FIELDS = { newSale: true, newComment: true, courseCompleted: true, locale: true } satisfies Prisma.NotificationPreferenceSelect;

/** What turning each kind of email off writes. */
const KIND_OFF: Record<NotificationKind, Prisma.NotificationPreferenceUpdateInput> = {
  newSale: { newSale: false },
  newComment: { newComment: false },
  courseCompleted: { courseCompleted: false },
};

/**
 * Types a settings row's language, which the column keeps as text.
 *
 * @param row The stored settings.
 * @returns The settings.
 */
function toPreferences(row: Prisma.NotificationPreferenceGetPayload<{ select: typeof PREFERENCE_FIELDS }>): Preferences {
  return { ...row, locale: row.locale as Preferences["locale"] };
}

/**
 * Staff members' email settings. Reads and saves go through the school's tenant client; an
 * unsubscribe link names no school, so it is looked up by its token with the unscoped client. It
 * satisfies `NotificationPreferenceStore` from `@reanit/core/notifications`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * const preferences = createNotificationPreferences(createNotificationPreferenceStore(db));
 */
export function createNotificationPreferenceStore(db: DbClient) {
  return {
    /**
     * Finds a staff member's settings for a school.
     *
     * @param schoolId The school.
     * @param userId The staff member.
     * @returns The settings, or null when they never saved any and got no staff email yet.
     * @throws {z.ZodError} When `schoolId` is not a UUID.
     */
    async findPreferences(schoolId: string, userId: string) {
      const row = await forSchool(db, schoolId).notificationPreference.findUnique({ where: { schoolId_userId: { schoolId, userId } }, select: PREFERENCE_FIELDS });
      return row && toPreferences(row);
    },

    /**
     * Saves a staff member's settings for a school, keeping their unsubscribe token.
     *
     * @param schoolId The school.
     * @param userId The staff member.
     * @param preferences The settings.
     * @returns The saved settings.
     * @throws {z.ZodError} When `schoolId` is not a UUID.
     */
    async savePreferences(schoolId: string, userId: string, preferences: Preferences) {
      return toPreferences(
        await forSchool(db, schoolId).notificationPreference.upsert({
          where: { schoolId_userId: { schoolId, userId } },
          create: { schoolId, userId, ...preferences },
          update: preferences,
          select: PREFERENCE_FIELDS,
        }),
      );
    },

    /**
     * Turns one kind of email off for whoever the token belongs to.
     *
     * @param token The unsubscribe token from the link.
     * @param kind The kind of email.
     * @returns The name of the token's school, or null when no settings have the token.
     */
    async unsubscribe(token: string, kind: NotificationKind) {
      const { count } = await db.notificationPreference.updateMany({ where: { unsubscribeToken: token }, data: KIND_OFF[kind] });
      if (count === 0) return null;
      const row = await db.notificationPreference.findUnique({ where: { unsubscribeToken: token }, select: { school: { select: { name: true } } } });
      return row && { schoolName: row.school.name };
    },
  };
}
