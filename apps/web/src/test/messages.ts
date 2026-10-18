import type { Locale } from "@/i18n/routing";

import en from "../../messages/en.json";
import km from "../../messages/km.json";

/** Every locale's message catalog, as the app loads them. */
export const MESSAGES = { en, km } satisfies Record<Locale, typeof en>;

/** Fixed time zone so date output does not depend on the machine. */
export const TIME_ZONE = "UTC";
