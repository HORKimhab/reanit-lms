import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SettingsState } from "@/app/[locale]/dashboard/settings/actions";
import type { MockSchool } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { SettingsForm } from "./settings-form";

const SCHOOL: MockSchool = { slug: "angkor-academy", name: "Angkor Academy", tagline: "", brand: "#008b52" };
const PNG = new File([new Uint8Array([1, 2, 3])], "logo.png", { type: "image/png" });

/** The settings save action, as a spy. */
type ActionSpy = ReturnType<typeof vi.fn<(state: SettingsState, formData: FormData) => Promise<SettingsState>>>;

/**
 * Builds a save action that always answers with the given result.
 *
 * @param result - What the action returns.
 * @returns The spy.
 */
function actionReturning(result: SettingsState): ActionSpy {
  return vi.fn<(state: SettingsState, formData: FormData) => Promise<SettingsState>>().mockResolvedValue(result);
}

/**
 * Renders the form and finds the live preview.
 *
 * @param action - The save action.
 * @returns The user-event instance and the preview region.
 */
async function setup(action: ActionSpy = actionReturning({ status: "saved", invalidFields: [] })) {
  const user = userEvent.setup();
  renderWithIntl(<SettingsForm school={SCHOOL} action={action} />);
  const preview = await screen.findByRole("region", { name: "Live preview" });
  return { user, preview };
}

describe("SettingsForm", () => {
  it("shows the saved settings in the form and the preview", async () => {
    const { preview } = await setup();
    expect(screen.getByRole("textbox", { name: "School name" })).toHaveValue("Angkor Academy");
    expect(screen.getByLabelText("Brand color")).toHaveValue("#008b52");
    expect(within(preview).getByRole("img", { name: "Logo preview" })).toHaveTextContent("A");
  });

  it("updates the preview's name and brand color as they are edited", async () => {
    const { user, preview } = await setup();
    const name = screen.getByRole("textbox", { name: "School name" });
    await user.clear(name);
    await user.type(name, "Mekong School");
    expect(within(preview).getByText("Mekong School")).toBeInTheDocument();
    expect(within(preview).getByRole("img", { name: "Logo preview" })).toHaveTextContent("M");

    // user-event cannot drive a native color picker, so fire the change the picker would.
    fireEvent.change(screen.getByLabelText("Brand color"), { target: { value: "#112233" } });
    expect(screen.getByText("#112233")).toBeInTheDocument();
    expect(within(preview).getByText("Mekong School").closest("[style]")).toHaveStyle({ "--brand": "#112233" });
  });

  it("previews a chosen logo", async () => {
    const { user, preview } = await setup();
    await user.upload(screen.getByLabelText("Logo"), PNG);
    await waitFor(() =>
      expect(within(preview).getByRole("img", { name: "Logo preview" })).toHaveAttribute("src", "data:image/png;base64,AQID"),
    );
  });

  it("rejects a logo that is not an allowed image, without previewing or keeping it", async () => {
    const { preview } = await setup();
    const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    // Skip the accept filter, as a user can by choosing "All files" in the picker.
    await userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText("Logo"), svg);
    expect(screen.getByLabelText("Logo")).toHaveAccessibleDescription(/Choose a PNG, JPEG or WebP image of up to 1 MB\./);
    expect(screen.getByLabelText("Logo")).toHaveAttribute("aria-invalid", "true");
    expect(within(preview).getByRole("img", { name: "Logo preview" })).toHaveTextContent("A");
    // The rejected file is cleared from the input, so saving keeps the current logo.
    expect((screen.getByLabelText("Logo") as HTMLInputElement).files).toHaveLength(0);
  });

  it("submits the edited fields and says the settings are saved", async () => {
    const action = actionReturning({ status: "saved", invalidFields: [] });
    const { user } = await setup(action);
    const name = screen.getByRole("textbox", { name: "School name" });
    await user.clear(name);
    await user.type(name, "Mekong School");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Settings saved")).toBeInTheDocument();
    const formData = action.mock.lastCall?.[1];
    expect(formData?.get("name")).toBe("Mekong School");
    expect(formData?.get("brand")).toBe("#008b52");
  });

  it("marks the fields the server rejected and explains each", async () => {
    const { user } = await setup(actionReturning({ status: "invalid", invalidFields: ["name", "brand"] }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const name = screen.getByRole("textbox", { name: "School name" });
    await waitFor(() => expect(name).toHaveAttribute("aria-invalid", "true"));
    expect(name).toHaveAccessibleDescription("Enter a name of up to 80 characters.");
    expect(screen.getByLabelText("Brand color")).toHaveAccessibleDescription("Pick a color.");
    expect(screen.getByLabelText("Logo")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Settings saved")).not.toBeInTheDocument();
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<SettingsForm school={SCHOOL} action={actionReturning({ status: "idle", invalidFields: [] })} />, {
      locale: "km",
    });
    expect(await screen.findByRole("textbox", { name: "ឈ្មោះសាលា" })).toBeInTheDocument();
  });
});
