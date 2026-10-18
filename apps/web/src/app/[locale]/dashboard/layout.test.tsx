import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderRoute, routeParams } from "@/test/render";

import DashboardLayout from "./layout";

describe("DashboardLayout", () => {
  it("shows the school, the section nav, the user and the page", async () => {
    await renderRoute(<DashboardLayout params={routeParams({})}>Page body</DashboardLayout>);
    expect(await screen.findByRole("link", { name: "Angkor Academy" })).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toHaveTextContent("Overview");
    expect(screen.getByRole("img", { name: "Sokha Chan" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Page body");
  });
});
