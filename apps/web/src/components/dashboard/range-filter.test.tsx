import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { RangeFilter } from "./range-filter";

const NOW = new Date("2026-10-20T10:00:00Z");

describe("RangeFilter", () => {
  it("links each preset to its days up to today, marking the one shown", async () => {
    renderWithIntl(<RangeFilter from="2026-09-21" to="2026-10-20" now={NOW} />);

    expect(await screen.findByRole("link", { name: "Last 7 days" })).toHaveAttribute("href", "/dashboard/analytics?from=2026-10-14&to=2026-10-20");
    expect(screen.getByRole("link", { name: "Last 30 days" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Last 90 days" })).not.toHaveAttribute("aria-current");
  });

  it("fills the custom range with the days shown", async () => {
    renderWithIntl(<RangeFilter from="2026-10-01" to="2026-10-05" now={NOW} />);

    expect(await screen.findByLabelText("From")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("To")).toHaveValue("2026-10-05");
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });
});
