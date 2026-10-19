import { Button } from "@reanit/ui/components/button";
import { Card, CardDescription, CardTitle } from "@reanit/ui/components/card";
import { useFormatter, useTranslations } from "next-intl";
import type * as React from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMoney } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";

const FEATURES = ["build", "sell", "teach"] as const;
// Sample values that show the locale formatters at work.
const SAMPLE_USD_MINOR = 4900;
const SAMPLE_KHR_MINOR = 20000000;
const SAMPLE_STUDENTS = 1250;
const SAMPLE_DATE = new Date(Date.UTC(2026, 9, 18));
const SAMPLE_BRAND = "oklch(0.6 0.2 30)";

/**
 * Platform home: pitch, calls to action, feature cards and i18n/brand samples.
 *
 * @returns The marketing home page.
 */
export function Landing() {
  const t = useTranslations("Home");
  const brand = useTranslations("Metadata");
  const format = useFormatter();
  const money = useMoney();

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold">{brand("title")}</span>
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
            <Link href="/onboarding">{t("createSchool")}</Link>
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
        <p>{t("samplePrice", { usd: money(SAMPLE_USD_MINOR, "USD"), khr: money(SAMPLE_KHR_MINOR, "KHR") })}</p>
        <p>{t("sampleStudents", { count: SAMPLE_STUDENTS, formatted: format.number(SAMPLE_STUDENTS) })}</p>
        <p>{format.dateTime(SAMPLE_DATE, { dateStyle: "long" })}</p>
      </section>

      {/* A school overrides --brand on a wrapper element. */}
      <section style={{ "--brand": SAMPLE_BRAND } as React.CSSProperties} className="flex gap-3">
        <Button>{t("brandSample")}</Button>
      </section>
    </main>
  );
}
