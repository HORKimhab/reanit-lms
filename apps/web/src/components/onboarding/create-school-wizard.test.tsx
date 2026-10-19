import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CreateSchoolState } from "@/app/[locale]/(auth)/onboarding/actions";
import { renderWithIntl } from "@/test/render";

import { CreateSchoolWizard } from "./create-school-wizard";

type Action = (state: CreateSchoolState, formData: FormData) => Promise<CreateSchoolState>;

/**
 * Builds a create-school action that always answers with the given result.
 *
 * @param status - Result status.
 * @param invalidFields - Fields the result marks invalid.
 * @returns The spy.
 */
function actionReturning(status: CreateSchoolState["status"] = "idle", invalidFields: string[] = []) {
  return vi.fn<Action>().mockResolvedValue({ status, invalidFields });
}

/**
 * Renders the wizard and fills in the name step.
 *
 * @param name - School name to type.
 * @param action - The create action.
 * @returns The action spy.
 */
async function fillName(name: string, action = actionReturning()) {
  renderWithIntl(<CreateSchoolWizard action={action} rootDomain="reanit.com" />);
  await userEvent.type(await screen.findByLabelText("School name"), name);
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  return action;
}

describe("CreateSchoolWizard", () => {
  it("starts on the name step with Next disabled until a name is typed", async () => {
    renderWithIntl(<CreateSchoolWizard action={actionReturning()} rootDomain="reanit.com" />);

    expect(await screen.findByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("School name"), "   ");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("suggests a subdomain from the name and previews the address", async () => {
    await fillName("Angkor Academy");

    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Subdomain")).toHaveValue("angkor-academy");
    expect(screen.getByText("angkor-academy.reanit.com")).toBeInTheDocument();
  });

  it("submits the name and the subdomain", async () => {
    const action = await fillName("Angkor Academy");

    await userEvent.click(screen.getByRole("button", { name: "Create school" }));

    const formData = action.mock.calls[0]![1]; // submitted once above
    expect(Object.fromEntries(formData)).toEqual({ name: "Angkor Academy", subdomain: "angkor-academy" });
  });

  it("keeps a subdomain the creator typed when they go back and rename", async () => {
    await fillName("Angkor");
    await userEvent.clear(screen.getByLabelText("Subdomain"));
    await userEvent.type(screen.getByLabelText("Subdomain"), "my-school");

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.type(screen.getByLabelText("School name"), " Academy");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByLabelText("Subdomain")).toHaveValue("my-school");
  });

  it("leaves the subdomain empty and Create disabled for a name with no Latin letters", async () => {
    await fillName("សាលាអង្គរ");

    expect(screen.getByLabelText("Subdomain")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Create school" })).toBeDisabled();
  });

  it("hides the address preview when no root domain is configured", async () => {
    renderWithIntl(<CreateSchoolWizard action={actionReturning()} />);
    await userEvent.type(await screen.findByLabelText("School name"), "Angkor");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.queryByText(/Your school will live at/)).not.toBeInTheDocument();
  });

  it("says the subdomain is taken on the subdomain step", async () => {
    await fillName("Angkor", actionReturning("subdomainTaken", ["subdomain"]));

    await userEvent.click(screen.getByRole("button", { name: "Create school" }));

    expect(await screen.findByLabelText("Subdomain")).toHaveAccessibleDescription(
      expect.stringContaining("Another school already uses this subdomain."),
    );
  });

  it("returns to the name step when the server rejects the name", async () => {
    await fillName("Angkor", actionReturning("invalid", ["name", "subdomain"]));

    await userEvent.click(screen.getByRole("button", { name: "Create school" }));

    expect(await screen.findByLabelText("School name")).toHaveAccessibleDescription(
      expect.stringContaining("Enter a name of up to 100 characters."),
    );
    expect(screen.getByLabelText("School name")).toHaveValue("Angkor");
  });

  it("speaks Khmer in the km locale", async () => {
    renderWithIntl(<CreateSchoolWizard action={actionReturning()} />, { locale: "km" });

    expect(await screen.findByLabelText("ឈ្មោះសាលា")).toBeInTheDocument();
    expect(screen.getByText("ជំហាន 1 នៃ 2")).toBeInTheDocument();
  });
});
