import { Button } from "@reanit/ui/components/button";
import { Card, CardDescription, CardTitle } from "@reanit/ui/components/card";
import { useFormatter, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import type * as React from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMoney } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";

const FEATURES = ["build", "sell", "teach"] as const;

// Placeholder home: shows tokens and i18n until the real screens (WEB-03+) land.
export default function Home({ params }: { params: Promise<{ locale: string }> }) {
  // The layout has already rejected unknown locales.
  setRequestLocale(use(params).locale as Locale);
  const t = useTranslations("Home");
  const format = useFormatter();
  const money = useMoney();

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold">Reanit</span>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-xl text-lg text-muted-foreground">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">{t("createSchool")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/s/${MOCK_SCHOOL_SLUG}`}>{t("browseCourses")}</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((key) => (
          <Card key={key}>
            <CardTitle>{t(`features.${key}.title`)}</CardTitle>
            <CardDescription>{t(`features.${key}.text`)}</CardDescription>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-1 text-sm text-muted-foreground">
        <p>{t("samplePrice", { usd: money(4900, "USD"), khr: money(20000000, "KHR") })}</p>
        <p>{t("sampleStudents", { count: 1250, formatted: format.number(1250) })}</p>
        <p>{format.dateTime(new Date(Date.UTC(2026, 9, 18)), { dateStyle: "long" })}</p>
      </section>

      {/* A school overrides --brand on a wrapper element. */}
      <section style={{ "--brand": "oklch(0.6 0.2 30)" } as React.CSSProperties} className="flex gap-3">
        <Button>{t("brandSample")}</Button>
      </section>
    </main>
  );
}
