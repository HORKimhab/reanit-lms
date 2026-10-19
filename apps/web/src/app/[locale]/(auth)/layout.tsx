import { Card } from "@reanit/ui/components/card";
import { useTranslations } from "next-intl";
import type * as React from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";

/**
 * Centered, mobile-first frame for the log-in, sign-up and onboarding pages.
 *
 * @param props - Layout props.
 * @param props.children - The auth page.
 * @returns The header and a card holding the page.
 */
export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  const brand = useTranslations("Metadata");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold">
          {brand("title")}
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-12 sm:pt-8">
        <Card className="p-6">{children}</Card>
      </main>
    </div>
  );
}
