import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SchoolLogo } from "./school-logo";

const LOGO = "data:image/png;base64,AA";

describe("SchoolLogo", () => {
  it("shows the uploaded logo under its label", () => {
    render(<SchoolLogo name="Angkor Academy" logoUrl={LOGO} label="Logo preview" />);
    expect(screen.getByRole("img", { name: "Logo preview" })).toHaveAttribute("src", LOGO);
  });

  it("shows the school's initial under its label when there is no logo", () => {
    render(<SchoolLogo name="Angkor Academy" label="Logo preview" />);
    expect(screen.getByRole("img", { name: "Logo preview" })).toHaveTextContent("A");
  });

  it("hides the logo from screen readers when it has no label", () => {
    render(<SchoolLogo name="Angkor Academy" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    render(<SchoolLogo name="Angkor Academy" logoUrl={LOGO} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
