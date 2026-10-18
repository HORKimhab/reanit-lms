import { act, render, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Component, Suspense } from "react";
import type * as React from "react";

import type { Locale } from "@/i18n/routing";

import { MESSAGES, TIME_ZONE } from "./messages";

/**
 * Builds a wrapper that provides the app's i18n context, as the root layout does.
 *
 * @param locale - UI locale.
 * @returns A wrapper component for `render` or `renderHook`.
 */
export function intlWrapper(locale: Locale = "en") {
  /**
   * Wraps children in the i18n provider.
   *
   * @param props - Wrapper props.
   * @param props.children - The UI under test.
   * @returns The provider around the children.
   */
  return function IntlWrapper({ children }: { children: React.ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone={TIME_ZONE}>
        {children}
      </NextIntlClientProvider>
    );
  };
}

/** Options shared by the render helpers. */
type RenderOptions = { locale?: Locale };

/**
 * Renders UI inside the app's i18n provider. Client components finish rendering on the next tick,
 * so await a `findBy*` query before asserting.
 *
 * @param ui - The element to render.
 * @param options - Render options.
 * @param options.locale - UI locale; defaults to English.
 * @returns Testing Library's render result.
 */
export function renderWithIntl(ui: React.ReactElement, { locale = "en" }: RenderOptions = {}) {
  return render(ui, { wrapper: intlWrapper(locale) });
}

/**
 * Renders a page that reads its `params` with `use()`, waiting until the params have resolved.
 *
 * @param ui - The page element.
 * @param options - Render options.
 * @param options.locale - UI locale; defaults to English.
 * @returns Testing Library's render result, once the page has rendered.
 */
export async function renderRoute(ui: React.ReactElement, { locale = "en" }: RenderOptions = {}) {
  let result: RenderResult | undefined;
  await act(async () => {
    result = renderWithIntl(<Suspense fallback={null}>{ui}</Suspense>, { locale });
  });
  // act() above has run, so the render result is set.
  return result as RenderResult;
}

/** Catches a render error and hands it to the test instead of failing the render. */
class Catch extends Component<{ onError: (error: unknown) => void; children: React.ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  /**
   * Switches to the failed state so nothing more renders.
   *
   * @returns The failed state.
   */
  static getDerivedStateFromError() {
    return { failed: true };
  }

  /**
   * Reports the caught error.
   *
   * @param error - What the child threw.
   */
  override componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  /**
   * Renders the children until one throws.
   *
   * @returns The children, or nothing after an error.
   */
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Renders a page that is expected to throw while rendering, such as one that calls `notFound()`.
 *
 * @param ui - The page element.
 * @returns What the page threw.
 */
export async function renderError(ui: React.ReactElement): Promise<unknown> {
  let caught: unknown;
  await renderRoute(
    <Catch
      onError={(error) => {
        caught = error;
      }}
    >
      {ui}
    </Catch>,
  );
  return caught;
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
