import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CertificateTemplateState } from "@/app/[locale]/dashboard/settings/actions";
import { renderWithIntl } from "@/test/render";

import { CertificateTemplateForm } from "./certificate-template-form";

/**
 * Builds a save action that answers with the given state.
 *
 * @param result - What saving returns.
 * @returns The spy.
 */
function saving(result: CertificateTemplateState) {
  return vi.fn<(state: CertificateTemplateState, formData: FormData) => Promise<CertificateTemplateState>>().mockResolvedValue(result);
}

describe("CertificateTemplateForm", () => {
  it("shows the saved signer and sends what the staff member types", async () => {
    const user = userEvent.setup();
    const save = saving({ status: "saved" });
    renderWithIntl(<CertificateTemplateForm template={{ signerName: "Dara Kim", signerTitle: null }} save={save} />);
    const title = await screen.findByRole("textbox", { name: "Signer's title" });
    expect(screen.getByRole("textbox", { name: "Signed by" })).toHaveValue("Dara Kim");

    await user.type(title, "Founder");
    await user.click(screen.getByRole("button", { name: "Save certificate" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Certificate saved.");
    const formData = save.mock.lastCall?.[1];
    expect([formData?.get("signerName"), formData?.get("signerTitle")]).toEqual(["Dara Kim", "Founder"]);
  });

  it("marks the signer invalid when the save rejects the lengths", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CertificateTemplateForm template={{ signerName: null, signerTitle: null }} save={saving({ status: "invalid" })} />);

    await user.click(await screen.findByRole("button", { name: "Save certificate" }));

    expect(await screen.findByRole("textbox", { name: "Signed by" })).toHaveAccessibleDescription("Keep each line to 80 characters or fewer.");
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<CertificateTemplateForm template={{ signerName: null, signerTitle: null }} save={saving({ status: "idle" })} />, { locale: "km" });

    expect(await screen.findByRole("heading", { name: "វិញ្ញាបនបត្រ" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "ចុះហត្ថលេខាដោយ" })).toHaveValue("");
  });
});
