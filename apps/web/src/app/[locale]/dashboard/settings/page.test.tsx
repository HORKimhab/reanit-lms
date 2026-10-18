import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import DashboardSettings from "./page";

vi.mock("next-intl/server", () => import("@/test/intl-server"));

describe("DashboardSettings", () => {
  it("shows the heading and that WEB-09 builds the screen", async () => {
    renderWithIntl(await DashboardSettings());
    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("This screen is built in WEB-09.")).toBeInTheDocument();
  });
});
