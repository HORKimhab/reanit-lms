import { createTranslator } from "next-intl";

import { routing, type Locale } from "@/i18n/routing";

import { MESSAGES } from "./messages";

// Test double for next-intl/server, which only runs inside React Server Components.
// Use with: vi.mock("next-intl/server", () => import("@/test/intl-server"));

/**
 * Returns a translator for the default locale, or the locale passed in the object form.
 *
 * @param options - A namespace, or `{ locale, namespace }` as `generateMetadata` passes it.
 * @returns The translator.
 */
export async function getTranslations(options?: string | { locale?: Locale; namespace?: string }) {
  const { locale = routing.defaultLocale, namespace } = typeof options === "string" ? { namespace: options } : (options ?? {});
  // The code under test is type-checked against real namespaces; the double accepts any.
  return createTranslator({ locale, messages: MESSAGES[locale], namespace: namespace as never });
}

/**
 * Returns the default locale.
 *
 * @returns "en".
 */
export async function getLocale() {
  return routing.defaultLocale;
}

/** No-op: static rendering hints do not matter in tests. */
export function setRequestLocale() {}

/**
 * Returns the request-config callback unchanged so tests can call it.
 *
 * @param factory - The callback passed by `i18n/request.ts`.
 * @returns The same callback.
 */
export function getRequestConfig<T>(factory: T) {
  return factory;
}
