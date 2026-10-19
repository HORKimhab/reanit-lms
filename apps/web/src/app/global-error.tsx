"use client";

import { Button } from "@reanit/ui/components/button";

import { bilingual, StandaloneStatusPage } from "@/components/shells/standalone-status-page";

import "./globals.css";

/**
 * Last-resort error page, shown when the localized layout itself fails, so it cannot use the visitor's language.
 *
 * @param props - Error boundary props.
 * @param props.reset - Renders the page again.
 * @returns The standalone error document with a retry button.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <StandaloneStatusPage kind="error">
      <Button onClick={reset}>{bilingual("retry")}</Button>
    </StandaloneStatusPage>
  );
}
