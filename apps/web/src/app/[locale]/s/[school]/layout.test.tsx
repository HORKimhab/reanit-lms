import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { NotFoundError } from "@/test/navigation";
import { renderWithIntl, routeParams } from "@/test/render";

import SchoolLayout from "./layout";

describe("SchoolLayout", () => {
  it("renders the school's pages when the school exists", async () => {
    renderWithIntl(await SchoolLayout({ children: "School page", params: routeParams({ school: MOCK_SCHOOL_SLUG }) }));
    expect(await screen.findByText("School page")).toBeInTheDocument();
  });

  it("404s when the school does not exist", async () => {
    await expect(SchoolLayout({ children: null, params: routeParams({ school: "no-such-school" }) })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
