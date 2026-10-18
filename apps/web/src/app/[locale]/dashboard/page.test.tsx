import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import DashboardOverview from "./page";

vi.mock("next-intl/server", () => import("@/test/intl-server"));

describe("DashboardOverview", () => {
  it("shows the heading and that WEB-07 builds the screen", async () => {
    renderWithIntl(await DashboardOverview());
    expect(await screen.findByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("This screen is built in WEB-07.")).toBeInTheDocument();
  });
});
