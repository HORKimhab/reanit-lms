import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type * as React from "react";

import type { Locale } from "@/i18n/routing";

import { MESSAGES, TIME_ZONE } from "./messages";

/**
 * Builds a wrapper that provides the app's i18n context, as the root layout does.
 *
 * @param locale - UI locale.
 * @param timeZone - The viewer's time zone; defaults to UTC.
 * @returns A wrapper component for `render` or `renderHook`.
 */
export function intlWrapper(locale: Locale = "en", timeZone = TIME_ZONE) {
  /**
   * Wraps children in the i18n provider.
   *
   * @param props - Wrapper props.
   * @param props.children - The UI under test.
   * @returns The provider around the children.
   */
  return function IntlWrapper({ children }: { children: React.ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone={timeZone}>
        {children}
      </NextIntlClientProvider>
    );
  };
}

/** Options shared by the render helpers. */
type RenderOptions = { locale?: Locale; timeZone?: string };

/**
 * Renders UI inside the app's i18n provider. Client components finish rendering on the next tick,
 * so await a `findBy*` query before asserting.
 *
 * @param ui - The element to render.
 * @param options - Render options.
 * @param options.locale - UI locale; defaults to English.
 * @param options.timeZone - The viewer's time zone; defaults to UTC.
 * @returns Testing Library's render result.
 */
export function renderWithIntl(ui: React.ReactElement, { locale = "en", timeZone }: RenderOptions = {}) {
  return render(ui, { wrapper: intlWrapper(locale, timeZone) });
}

/**
 * Builds the `params` prop Next passes to pages and layouts.
 *
 * @param params - Route params other than the locale.
 * @param locale - The locale segment; defaults to English.
 * @returns A resolved params promise.
 */
export function routeParams<T extends Record<string, string>>(params: T, locale: Locale = "en") {
  return Promise.resolve({ locale, ...params });
}

/**
 * Builds the props Next passes to a page: `params` plus empty `searchParams`.
 *
 * @param params - Route params other than the locale.
 * @param locale - The locale segment; defaults to English.
 * @returns Page props.
 */
export function routeProps<T extends Record<string, string>>(params: T, locale: Locale = "en") {
  return { params: routeParams(params, locale), searchParams: Promise.resolve({}) };
}
