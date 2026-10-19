import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field } from "./field";

describe("Field", () => {
  it("labels its control", () => {
    render(<Field label="Email">{(control) => <input {...control} />}</Field>);

    expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
  });

  it("describes the control with its hint", () => {
    render(
      <Field label="Logo" hint="PNG up to 2 MB">
        {(control) => <input {...control} />}
      </Field>,
    );

    expect(screen.getByRole("textbox", { name: "Logo" })).toHaveAccessibleDescription("PNG up to 2 MB");
  });

  it("marks the control invalid and describes it with the error", () => {
    render(
      <Field label="Email" hint="We never share it" error="Enter a valid email address.">
        {(control) => <input {...control} />}
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("We never share it Enter a valid email address.");
  });

  it("leaves the control valid and undescribed without a hint or error", () => {
    render(<Field label="Email">{(control) => <input {...control} />}</Field>);

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toBeValid();
    expect(input).not.toHaveAttribute("aria-describedby");
  });
});
