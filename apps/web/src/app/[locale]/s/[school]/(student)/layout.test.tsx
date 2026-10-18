import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderWithIntl, routeParams } from "@/test/render";

import StudentLayout from "./layout";

describe("StudentLayout", () => {
  it("wraps the page in the student header without a footer", async () => {
    renderWithIntl(await StudentLayout({ children: "My stuff", params: routeParams({ school: MOCK_SCHOOL_SLUG }) }));
    expect(await screen.findByRole("img", { name: "Sokha Chan" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("My stuff");
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});
