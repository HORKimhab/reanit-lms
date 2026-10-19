import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { SubmitRow } from "./submit-row";

describe("SubmitRow", () => {
  it("offers the save button and announces a finished save", async () => {
    renderWithIntl(<SubmitRow label="Save" pendingLabel="Saving…" isPending={false} savedMessage="Saved." />);

    expect(await screen.findByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
  });

  it("disables the button and hides the last result while saving", async () => {
    renderWithIntl(<SubmitRow label="Save" pendingLabel="Saving…" isPending savedMessage="Saved." />);

    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
