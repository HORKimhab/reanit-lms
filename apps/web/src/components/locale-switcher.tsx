"use client";

import { Button } from "@reanit/ui/components/button";
import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Buttons that switch the UI language while staying on the same page.
 *
 * @returns A labelled group with one toggle button per locale.
 */
export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div role="group" aria-label={t("label")} className="flex gap-1">
      {routing.locales.map((l: Locale) => (
        <Button
          key={l}
          size="sm"
          variant={l === locale ? "secondary" : "ghost"}
          aria-pressed={l === locale}
          onClick={() => router.replace(pathname, { locale: l })}
        >
          {t(l)}
        </Button>
      ))}
    </div>
  );
}
