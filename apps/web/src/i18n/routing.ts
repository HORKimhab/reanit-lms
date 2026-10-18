import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "km"],
  defaultLocale: "en",
  // English URLs stay unprefixed (/courses); Khmer is /km/courses.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
