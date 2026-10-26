import { InvalidUnsubscribeLinkError } from "./errors";
import type { NotificationPreferenceStore } from "./ports";
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences, type UnsubscribeInput } from "./rules";

/**
 * Builds the use cases behind staff email settings: read and save them per school, and the
 * unsubscribe link every staff email carries.
 *
 * @param store Persistence for the settings.
 * @returns The settings operations.
 * @example
 * const preferences = createNotificationPreferences(createNotificationPreferenceStore(db));
 */
export function createNotificationPreferences(store: NotificationPreferenceStore) {
  return {
    /**
     * Reads a staff member's email settings for a school.
     *
     * @param schoolId The school.
     * @param userId The staff member.
     * @returns Their settings; every email, in English, until they save any.
     */
    async getPreferences(schoolId: string, userId: string): Promise<NotificationPreferences> {
      return (await store.findPreferences(schoolId, userId)) ?? DEFAULT_NOTIFICATION_PREFERENCES;
    },

    /**
     * Saves a staff member's email settings for a school.
     *
     * @param schoolId The school.
     * @param userId The staff member.
     * @param preferences Parsed settings.
     * @returns The saved settings.
     */
    savePreferences(schoolId: string, userId: string, preferences: NotificationPreferences): Promise<NotificationPreferences> {
      return store.savePreferences(schoolId, userId, preferences);
    },

    /**
     * Stops one kind of email for the staff member an unsubscribe link was sent to; repeating it is harmless.
     *
     * @param input The link's token and kind of email.
     * @param input.token The staff member's unsubscribe token.
     * @param input.kind The kind of email to stop.
     * @returns The name of the school the emails were about.
     * @throws {InvalidUnsubscribeLinkError} When no staff member has the token.
     */
    async unsubscribe({ token, kind }: UnsubscribeInput): Promise<{ schoolName: string }> {
      const result = await store.unsubscribe(token, kind);
      if (!result) throw new InvalidUnsubscribeLinkError();
      return result;
    },
  };
}

/** The staff email settings use cases. */
export type NotificationPreferenceService = ReturnType<typeof createNotificationPreferences>;
