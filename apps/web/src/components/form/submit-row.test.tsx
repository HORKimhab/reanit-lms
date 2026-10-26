import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { saveButtonProps, SubmitRow } from "./submit-row";

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

describe("saveButtonProps", () => {
  const MESSAGES = { save: "Save certificate", saving: "Saving…", saved: "Certificate saved." };

  it("labels the button from the form's messages and shows its saved message after a save", () => {
    expect(saveButtonProps((key) => MESSAGES[key], false, true)).toEqual({
      label: "Save certificate",
      pendingLabel: "Saving…",
      isPending: false,
      savedMessage: "Certificate saved.",
    });
  });

  it("shows no saved message before a save succeeds", () => {
    expect(saveButtonProps((key) => MESSAGES[key], true, false).savedMessage).toBeUndefined();
  });
});
