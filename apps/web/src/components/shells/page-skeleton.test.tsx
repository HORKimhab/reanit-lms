import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { PageSkeleton } from "./page-skeleton";

describe("PageSkeleton", () => {
  it.each(["table", "cards", "article"] as const)("tells assistive tech the %s page is loading", async (variant) => {
    renderWithIntl(<PageSkeleton variant={variant} />);
    expect(await screen.findByRole("status", { name: "Loading…" })).toBeInTheDocument();
  });

  it("says it in Khmer for km", async () => {
    renderWithIntl(<PageSkeleton variant="table" />, { locale: "km" });
    expect(await screen.findByRole("status", { name: "កំពុងផ្ទុក…" })).toBeInTheDocument();
  });
});
