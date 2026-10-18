import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG, requireMockSchool } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { SchoolFooter } from "./school-footer";

describe("SchoolFooter", () => {
  it("credits the school and the platform", async () => {
    renderWithIntl(<SchoolFooter school={requireMockSchool(MOCK_SCHOOL_SLUG)} />);
    const footer = await screen.findByRole("contentinfo");
    expect(footer).toHaveTextContent("© Angkor Academy");
    expect(footer).toHaveTextContent("Powered by Reanit");
  });
});
