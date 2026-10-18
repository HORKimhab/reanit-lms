import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import DashboardCourses from "./page";

vi.mock("next-intl/server", () => import("@/test/intl-server"));

describe("DashboardCourses", () => {
  it("shows the heading and that WEB-07 builds the screen", async () => {
    renderWithIntl(await DashboardCourses());
    expect(await screen.findByRole("heading", { level: 1, name: "Courses" })).toBeInTheDocument();
    expect(screen.getByText("This screen is built in WEB-07.")).toBeInTheDocument();
  });
});
