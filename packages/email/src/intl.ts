import { moneyFormat } from "@reanit/core/commerce";
import type { EmailLocale } from "@reanit/core/notifications";
import { createFormatter, createTranslator } from "use-intl";

import en from "./messages/en.json";
import km from "./messages/km.json";

/** Every email's text, per language. */
const MESSAGES: Record<EmailLocale, typeof en> = { en, km };

/** Readers are mostly in Cambodia and an email cannot know the reader's zone, so times are shown in Phnom Penh time. */
const EMAIL_TIME_ZONE = "Asia/Phnom_Penh";

/**
 * Gives an email's translator and formatters for its reader's language.
 *
 * @param locale The reader's language.
 * @returns `t` for the messages, `format` for dates and numbers, and `money` for stored amounts.
 */
export function emailIntl(locale: EmailLocale) {
  const format = createFormatter({ locale, timeZone: EMAIL_TIME_ZONE });

  /**
   * Formats stored money in the reader's language.
   *
   * @param money The amount.
   * @param money.amount Integer minor units.
   * @param money.currency ISO code.
   * @returns The displayed amount.
   */
  function money({ amount, currency }: { amount: number; currency: string }) {
    const { value, options } = moneyFormat(amount, currency);
    return format.number(value, options);
  }

  return { t: createTranslator({ locale, messages: MESSAGES[locale] }), format, money };
}
