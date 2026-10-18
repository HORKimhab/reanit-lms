import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { PagePlaceholder } from "./page-placeholder";

describe("PagePlaceholder", () => {
  it("shows the heading and which task builds the screen", async () => {
    renderWithIntl(<PagePlaceholder title="Students" task="WEB-09" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Students" })).toBeInTheDocument();
    expect(screen.getByText("This screen is built in WEB-09.")).toBeInTheDocument();
  });
});
