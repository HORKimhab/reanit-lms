import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getMockCourse, type MockCourse } from "@/mocks/courses";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { Price } from "./price";

const COURSE = getMockCourse(MOCK_SCHOOL_SLUG, "brand-design-basics") as MockCourse;

describe("Price", () => {
  it("shows the price and the struck-through compare-at price", async () => {
    renderWithIntl(<Price course={COURSE} />);
    expect(await screen.findByText("$49.00")).toBeInTheDocument();
    expect(screen.getByText("$79.00").tagName).toBe("S");
  });

  it("shows only the price when there is no compare-at price", async () => {
    renderWithIntl(<Price course={{ ...COURSE, compareAtMinor: undefined }} />);
    expect(await screen.findByText("$49.00")).toBeInTheDocument();
    expect(screen.queryByText("$79.00")).not.toBeInTheDocument();
  });
});
