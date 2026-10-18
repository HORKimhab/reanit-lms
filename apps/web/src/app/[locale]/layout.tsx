import type { Metadata } from "next";
import { Inter, Kantumruy_Pro } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ThemeProvider } from "@/components/theme-provider";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Latin glyphs from Inter, Khmer glyphs from Kantumruy Pro.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const kantumruy = Kantumruy_Pro({ subsets: ["khmer", "latin"], variable: "--font-kantumruy" });

/**
 * Pre-renders every supported locale.
 *
 * @returns One param set per locale.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Sets the page title and description in the request's locale.
 *
 * @param props - Metadata props.
 * @param props.params - Route params with the locale.
 * @returns The localized metadata; unknown locales 404.
 */
export async function generateMetadata({ params }: Pick<LayoutProps<"/[locale]">, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("title"), description: t("description") };
}

/**
 * Root document for a locale: fonts, `lang`, messages and theme. Unknown locales 404.
 *
 * @param props - Layout props.
 * @param props.children - The page.
 * @param props.params - Route params with the locale.
 * @returns The `<html>` document.
 */
export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${kantumruy.variable}`}>
      <body>
        <NextIntlClientProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
