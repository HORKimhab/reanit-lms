import type { EmailLocale } from "@reanit/core/notifications";
import { createFormatter, createTranslator } from "use-intl";

import en from "./messages/en.json";
import km from "./messages/km.json";

/** Every email's text, per language. */
const MESSAGES: Record<EmailLocale, typeof en> = { en, km };

/** Readers are mostly in Cambodia and an email cannot know the reader's zone, so times are shown in Phnom Penh time. */
const EMAIL_TIME_ZONE = "Asia/Phnom_Penh";

/**
 * Gives an email's translator and formatter for its reader's language.
 *
 * @param locale The reader's language.
 * @returns `t` for the messages and `format` for dates and numbers.
 */
export function emailIntl(locale: EmailLocale) {
  return {
    t: createTranslator({ locale, messages: MESSAGES[locale] }),
    format: createFormatter({ locale, timeZone: EMAIL_TIME_ZONE }),
  };
}
