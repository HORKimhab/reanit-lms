import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { requireMockSchool, MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { SchoolMark } from "./school-mark";

describe("SchoolMark", () => {
  it("links to the school home, named after the school", async () => {
    renderWithIntl(<SchoolMark school={requireMockSchool(MOCK_SCHOOL_SLUG)} />);
    expect(await screen.findByRole("link", { name: "Angkor Academy" })).toHaveAttribute("href", `/s/${MOCK_SCHOOL_SLUG}`);
  });

  it("shows the school's logo inside the link when it has one", async () => {
    const school = { ...requireMockSchool(MOCK_SCHOOL_SLUG), logoUrl: "data:image/png;base64,AA" };
    renderWithIntl(<SchoolMark school={school} />);
    const link = await screen.findByRole("link", { name: "Angkor Academy" });
    // The logo is decorative next to the name, so it has the presentation role.
    expect(within(link).getByRole("presentation")).toHaveAttribute("src", "data:image/png;base64,AA");
  });
});
