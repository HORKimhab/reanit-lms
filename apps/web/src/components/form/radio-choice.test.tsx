import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { RadioChoice } from "./radio-choice";

describe("RadioChoice", () => {
  it("shows the options under the legend, the picked one checked, and reports a new pick", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<RadioChoice legend="Size" name="size" options={["small", "large"]} value="small" onChange={onChange} labelOf={(option) => option.toUpperCase()} />);

    expect(await screen.findByRole("group", { name: "Size" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "SMALL" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "LARGE" }));

    expect(onChange).toHaveBeenCalledWith("large");
  });
});
