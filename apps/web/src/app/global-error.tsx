"use client";

import { Button } from "@reanit/ui/components/button";

import { bilingual, StandaloneStatusPage } from "@/components/shells/standalone-status-page";
import { useReportError } from "@/telemetry/use-report-error";

import "./globals.css";

/**
 * Last-resort error page, shown when the localized layout itself fails, so it cannot use the visitor's language.
 * Reports the error to Sentry.
 *
 * @param props - Error boundary props.
 * @param props.error - What was thrown.
 * @param props.reset - Renders the page again.
 * @returns The standalone error document with a retry button.
 */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useReportError(error);
  return (
    <StandaloneStatusPage kind="error">
      <Button onClick={reset}>{bilingual("retry")}</Button>
    </StandaloneStatusPage>
  );
}
