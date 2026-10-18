import { defineRouting } from "next-intl/routing";

/** Supported locales and how they appear in URLs. */
export const routing = defineRouting({
  locales: ["en", "km"],
  defaultLocale: "en",
  // English URLs stay unprefixed (/courses); Khmer is /km/courses.
  localePrefix: "as-needed",
});

/** A supported locale code. */
export type Locale = (typeof routing.locales)[number];
