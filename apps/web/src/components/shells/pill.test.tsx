import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { Pill } from "./pill";

describe("Pill", () => {
  it("shows its label", async () => {
    renderWithIntl(<Pill tone="danger">Failed</Pill>);

    expect(await screen.findByText("Failed")).toBeInTheDocument();
  });
});
