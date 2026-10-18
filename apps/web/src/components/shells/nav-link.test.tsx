import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setPathname } from "@/test/navigation";
import { renderWithIntl } from "@/test/render";

import { NavLink } from "./nav-link";

describe("NavLink", () => {
  it("marks itself as the current page when the path matches", async () => {
    setPathname("/dashboard");
    renderWithIntl(<NavLink href="/dashboard">Overview</NavLink>);
    expect(await screen.findByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  it("stays active on a sub-page when not exact", async () => {
    setPathname("/dashboard/courses/new");
    renderWithIntl(<NavLink href="/dashboard/courses">Courses</NavLink>);
    expect(await screen.findByRole("link", { name: "Courses" })).toHaveAttribute("aria-current", "page");
  });

  it("is not active on a sub-page when exact", async () => {
    setPathname("/dashboard/courses");
    renderWithIntl(
      <NavLink href="/dashboard" exact>
        Overview
      </NavLink>,
    );
    expect(await screen.findByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("is not active on a path that only shares a prefix", async () => {
    setPathname("/dashboard-old");
    renderWithIntl(<NavLink href="/dashboard">Overview</NavLink>);
    expect(await screen.findByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("matches and links with the locale prefix when the locale is km", async () => {
    setPathname("/km/dashboard");
    renderWithIntl(<NavLink href="/dashboard">Overview</NavLink>, { locale: "km" });
    const link = await screen.findByRole("link", { name: "Overview" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveAttribute("href", "/km/dashboard");
  });
});
