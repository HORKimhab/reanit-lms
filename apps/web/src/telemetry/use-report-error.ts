"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Reports an error an error boundary caught to Sentry, once per error. React swallows these,
 * so Sentry's global handlers never see them.
 *
 * @param error The caught error.
 */
export function useReportError(error: Error) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
}
