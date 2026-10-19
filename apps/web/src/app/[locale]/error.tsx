"use client";

import { Button, buttonVariants } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";

import { StatusPage } from "@/components/shells/status-page";
import { Link } from "@/i18n/navigation";
import { useReportError } from "@/telemetry/use-report-error";

/**
 * Error page in the visitor's language, for anything a page throws that it does not handle. Reports the error to Sentry.
 *
 * @param props - Error boundary props.
 * @param props.error - What was thrown; its `digest` matches the server's log entry.
 * @param props.reset - Renders the page again.
 * @returns The error page with retry and home actions, and the reference to quote to support.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("Status");
  useReportError(error);
  return (
    <StatusPage code={500} title={t("errorTitle")} text={t("errorText")}>
      <Button onClick={reset}>{t("retry")}</Button>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        {t("home")}
      </Link>
      {error.digest ? <p className="w-full text-xs text-muted-foreground">{t("reference", { digest: error.digest })}</p> : null}
    </StatusPage>
  );
}
