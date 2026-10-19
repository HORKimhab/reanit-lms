import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setPathname } from "@/test/navigation";
import { renderWithIntl } from "@/test/render";

import { DashboardNav } from "./dashboard-nav";

describe("DashboardNav", () => {
  it("links to every dashboard section", async () => {
    renderWithIntl(<DashboardNav />);
    await screen.findByRole("navigation");
    expect(screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Overview", "/dashboard"],
      ["Courses", "/dashboard/courses"],
      ["Students", "/dashboard/students"],
      ["Coupons", "/dashboard/coupons"],
      ["Settings", "/dashboard/settings"],
    ]);
  });

  it("marks only the section being viewed as current", async () => {
    setPathname("/dashboard/students");
    renderWithIntl(<DashboardNav />);
    expect(await screen.findByRole("link", { name: "Students" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<DashboardNav />, { locale: "km" });
    expect(await screen.findByRole("link", { name: "ទិដ្ឋភាពទូទៅ" })).toBeInTheDocument();
  });
});
