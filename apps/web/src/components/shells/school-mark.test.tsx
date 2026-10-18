import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { requireMockSchool, MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { SchoolMark } from "./school-mark";

describe("SchoolMark", () => {
  it("links to the school home, named after the school", async () => {
    renderWithIntl(<SchoolMark school={requireMockSchool(MOCK_SCHOOL_SLUG)} />);
    expect(await screen.findByRole("link", { name: "Angkor Academy" })).toHaveAttribute("href", `/s/${MOCK_SCHOOL_SLUG}`);
  });
});
