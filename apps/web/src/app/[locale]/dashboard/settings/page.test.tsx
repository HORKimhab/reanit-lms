import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onApi } from "@/test/api";
import { renderWithIntl } from "@/test/render";
import { signIn } from "@/test/session";
import { STAFF_SCHOOL } from "@/test/staff";

import DashboardSettings from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

// The page only composes SettingsForm, which has its own tests; its role branch is tested here.
describe("DashboardSettings", () => {
  it.each(["owner", "admin"])("shows the settings form to an %s", async (role) => {
    signIn();
    onApi("GET /schools/current", Response.json({ school: STAFF_SCHOOL, role }));

    renderWithIntl(await DashboardSettings());

    expect(await screen.findByRole("textbox", { name: "School name" })).toHaveValue("Angkor Academy");
  });

  it("tells an instructor they cannot change the settings", async () => {
    signIn();
    onApi("GET /schools/current", Response.json({ school: STAFF_SCHOOL, role: "instructor" }));

    renderWithIntl(await DashboardSettings());

    expect(await screen.findByText("Only the school's owner and admins can change its settings.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "School name" })).not.toBeInTheDocument();
  });
});
