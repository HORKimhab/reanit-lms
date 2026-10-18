import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderRoute, routeProps } from "@/test/render";

import MyCourses from "./page";

describe("MyCourses", () => {
  it("splits enrollments into in progress and completed", async () => {
    await renderRoute(<MyCourses {...routeProps({ school: MOCK_SCHOOL_SLUG })} />);
    const inProgress = (await screen.findByRole("heading", { name: "In progress" })).closest("section") as HTMLElement;
    const completed = screen.getByRole("heading", { name: "Completed" }).closest("section") as HTMLElement;
    expect(within(inProgress).getByRole("heading", { name: "Brand Design Basics" })).toBeInTheDocument();
    expect(within(completed).getByRole("heading", { name: "Social Media Content That Sells" })).toBeInTheDocument();
  });

  it("shows an empty state linking to the catalog when there are no enrollments", async () => {
    await renderRoute(<MyCourses {...routeProps({ school: "empty-school" })} />);
    expect(await screen.findByRole("heading", { name: "No courses yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse courses" })).toHaveAttribute("href", "/s/empty-school");
  });

  it("uses Khmer headings when the locale is km", async () => {
    await renderRoute(<MyCourses {...routeProps({ school: MOCK_SCHOOL_SLUG })} />, { locale: "km" });
    expect(await screen.findByRole("heading", { name: "កំពុងរៀន" })).toBeInTheDocument();
  });
});
