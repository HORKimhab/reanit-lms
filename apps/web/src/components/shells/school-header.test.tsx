import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG, requireMockSchool } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { SchoolHeader } from "./school-header";

const SCHOOL = requireMockSchool(MOCK_SCHOOL_SLUG);
const BASE = `/s/${MOCK_SCHOOL_SLUG}`;

describe("SchoolHeader", () => {
  it("shows catalog links and a log-in button on the public site", async () => {
    renderWithIntl(<SchoolHeader school={SCHOOL} variant="site" />);
    const nav = await screen.findByRole("navigation");
    expect(within(nav).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Courses", BASE],
      ["My courses", `${BASE}/my-courses`],
    ]);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent(`${BASE}/my-courses`)}`,
    );
  });

  it("shows the student's links and avatar in the student area", async () => {
    renderWithIntl(<SchoolHeader school={SCHOOL} variant="student" />);
    const nav = await screen.findByRole("navigation");
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["My courses", "Purchases", "All courses"]);
    expect(screen.getByRole("img", { name: "Sokha Chan" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("offers language and theme controls", async () => {
    renderWithIntl(<SchoolHeader school={SCHOOL} variant="site" />);
    expect(await screen.findByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument();
  });
});
