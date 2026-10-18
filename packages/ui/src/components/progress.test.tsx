import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Progress } from "./progress";

describe("Progress", () => {
  it("exposes its value as a labelled progressbar", () => {
    render(<Progress value={40} aria-label="Course progress" />);
    const bar = screen.getByRole("progressbar", { name: "Course progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("rounds a fractional value", () => {
    render(<Progress value={44.4} aria-label="Progress" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "44");
  });

  it("clamps values above 100", () => {
    render(<Progress value={150} aria-label="Progress" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("clamps values below 0", () => {
    render(<Progress value={-5} aria-label="Progress" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});
