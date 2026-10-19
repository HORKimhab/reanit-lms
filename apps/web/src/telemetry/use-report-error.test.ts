import * as Sentry from "@sentry/nextjs";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useReportError } from "./use-report-error";

describe("useReportError", () => {
  it("reports an error once however often the boundary re-renders", () => {
    const error = new Error("boom");
    const { rerender } = renderHook(() => useReportError(error));

    rerender();

    expect(Sentry.captureException).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("reports a new error when the boundary catches another one", () => {
    const first = new Error("first");
    const second = new Error("second");
    const { rerender } = renderHook(({ error }) => useReportError(error), { initialProps: { error: first } });

    rerender({ error: second });

    expect(Sentry.captureException).toHaveBeenLastCalledWith(second);
    expect(Sentry.captureException).toHaveBeenCalledTimes(2);
  });
});
