import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onApi } from "@/test/api";
import { renderWithIntl } from "@/test/render";
import { signIn } from "@/test/session";
import { STAFF_SCHOOL } from "@/test/staff";

import DashboardSettings from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

// The page only composes the settings forms, which have their own tests; its role branch is tested here.
const PREFERENCES = { newSale: true, newComment: true, courseCompleted: true, locale: "en" };
describe("DashboardSettings", () => {
  it.each(["owner", "admin"])("shows the settings, certificate and custom domain forms to an %s", async (role) => {
    signIn();
    onApi("GET /schools/current", Response.json({ school: STAFF_SCHOOL, role }));
    onApi("GET /certificates/template", Response.json({ template: { signerName: "Dara Kim", signerTitle: null } }));
    onApi("GET /schools/current/domain", Response.json({ isAvailable: true, domain: null }));
    onApi("GET /notifications/preferences", Response.json({ preferences: PREFERENCES }));

    renderWithIntl(await DashboardSettings());

    expect(await screen.findByRole("textbox", { name: "School name" })).toHaveValue("Angkor Academy");
    expect(screen.getByRole("textbox", { name: "Signed by" })).toHaveValue("Dara Kim");
    expect(screen.getByRole("textbox", { name: "Domain" })).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: /A sale is made/ })).toBeChecked();
  });

  it("tells an instructor they cannot change the school's settings, and offers only the emails they can get", async () => {
    signIn();
    onApi("GET /schools/current", Response.json({ school: STAFF_SCHOOL, role: "instructor" }));
    onApi("GET /notifications/preferences", Response.json({ preferences: PREFERENCES }));

    renderWithIntl(await DashboardSettings());

    expect(await screen.findByText("Only the school's owner and admins can change its settings.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "School name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Signed by" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Domain" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /A student comments/ })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /A sale is made/ })).not.toBeInTheDocument();
  });
});
