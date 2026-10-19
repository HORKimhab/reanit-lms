import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SettingsState } from "@/app/[locale]/dashboard/settings/actions";
import { onApi, problem, requestTo } from "@/test/api";
import { renderWithIntl } from "@/test/render";
import { STAFF_SCHOOL } from "@/test/staff";

import { SettingsForm, type SettingsActions } from "./settings-form";

const PNG = new File([new Uint8Array([1, 2, 3])], "logo.png", { type: "image/png" });
const LOGO_KEY = "schools/s/logo/a.png";
const UPLOAD_URL = "https://storage.test/schools/s/logo/a.png?signed";
const STORAGE_ROUTE = "PUT /schools/s/logo/a.png";

/**
 * Builds actions that presign the logo and save with the given result.
 *
 * @param result - What saving returns.
 * @returns Spies for each action.
 */
function actionsSaving(result: SettingsState = { status: "saved", invalidFields: [] }) {
  return {
    save: vi.fn<SettingsActions["save"]>().mockResolvedValue(result),
    startLogoUpload: vi
      .fn<SettingsActions["startLogoUpload"]>()
      .mockResolvedValue({ status: "ready", url: UPLOAD_URL, headers: { "content-type": "image/png" }, key: LOGO_KEY }),
  };
}

/**
 * Renders the form for `STAFF_SCHOOL` and finds the live preview.
 *
 * @param actions - The server actions.
 * @returns The user-event instance and the preview region.
 */
async function setup(actions = actionsSaving()) {
  const user = userEvent.setup();
  renderWithIntl(<SettingsForm school={STAFF_SCHOOL} actions={actions} />);
  const preview = await screen.findByRole("region", { name: "Live preview" });
  return { user, preview };
}

/**
 * Picks `PNG` as the logo and saves the form.
 *
 * @param user - The user-event instance from `setup`.
 */
async function saveWithLogo(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText("Logo"), PNG);
  await user.click(screen.getByRole("button", { name: "Save changes" }));
}

describe("SettingsForm", () => {
  it("shows the saved settings in the form and the preview", async () => {
    const { preview } = await setup();
    expect(screen.getByRole("textbox", { name: "School name" })).toHaveValue("Angkor Academy");
    expect(screen.getByLabelText("Brand color")).toHaveValue("#0055aa");
    expect(within(preview).getByRole("img", { name: "Logo preview" })).toHaveTextContent("A");
  });

  it("starts from the default brand color and shows the saved logo", async () => {
    renderWithIntl(
      <SettingsForm school={{ ...STAFF_SCHOOL, brandColor: null, logoUrl: "https://storage.test/logo.png" }} actions={actionsSaving()} />,
    );
    expect(await screen.findByLabelText("Brand color")).toHaveValue("#008b52");
    expect(screen.getByRole("img", { name: "Logo preview" })).toHaveAttribute("src", "https://storage.test/logo.png");
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

  it("rejects a logo that is not an allowed image, without previewing or uploading it", async () => {
    const actions = actionsSaving();
    const { preview } = await setup(actions);
    const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    // Skip the accept filter, as a user can by choosing "All files" in the picker.
    await userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText("Logo"), svg);
    expect(screen.getByLabelText("Logo")).toHaveAccessibleDescription(/Choose a PNG, JPEG or WebP image of up to 1 MB\./);
    expect(screen.getByLabelText("Logo")).toHaveAttribute("aria-invalid", "true");
    expect(within(preview).getByRole("img", { name: "Logo preview" })).toHaveTextContent("A");

    await userEvent.setup().click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Settings saved");
    expect(actions.startLogoUpload).not.toHaveBeenCalled();
  });

  it("submits the edited fields without a logo key when no logo was chosen", async () => {
    const actions = actionsSaving();
    const { user } = await setup(actions);
    const name = screen.getByRole("textbox", { name: "School name" });
    await user.clear(name);
    await user.type(name, "Mekong School");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Settings saved")).toBeInTheDocument();
    const formData = actions.save.mock.lastCall?.[1];
    expect(formData?.get("name")).toBe("Mekong School");
    expect(formData?.get("brand")).toBe("#0055aa");
    expect(formData?.has("logoKey")).toBe(false);
    expect(actions.startLogoUpload).not.toHaveBeenCalled();
  });

  it("uploads a chosen logo straight to storage, then saves its key", async () => {
    onApi(STORAGE_ROUTE, new Response(null, { status: 200 }));
    const actions = actionsSaving();
    const { user } = await setup(actions);
    await saveWithLogo(user);

    expect(await screen.findByText("Settings saved")).toBeInTheDocument();
    expect(actions.startLogoUpload).toHaveBeenCalledWith({ contentType: "image/png", sizeBytes: 3 });
    expect(requestTo(STORAGE_ROUTE)?.headers.get("content-type")).toBe("image/png");
    expect(actions.save.mock.lastCall?.[1].get("logoKey")).toBe(LOGO_KEY);
  });

  it("does not upload the same logo again on the next save", async () => {
    onApi(STORAGE_ROUTE, new Response(null, { status: 200 }));
    const actions = actionsSaving();
    const { user } = await setup(actions);
    await saveWithLogo(user);
    await screen.findByText("Settings saved");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(actions.save).toHaveBeenCalledTimes(2));
    expect(actions.startLogoUpload).toHaveBeenCalledTimes(1);
    expect(actions.save.mock.lastCall?.[1].has("logoKey")).toBe(false);
  });

  it("marks the logo invalid when the API refuses the image, without saving", async () => {
    const actions = actionsSaving();
    actions.startLogoUpload.mockResolvedValue({ status: "rejected" });
    const { user } = await setup(actions);
    await saveWithLogo(user);

    await waitFor(() => expect(screen.getByLabelText("Logo")).toHaveAttribute("aria-invalid", "true"));
    expect(actions.save).not.toHaveBeenCalled();
  });

  it("says the save failed when storage refuses the upload, without saving", async () => {
    onApi(STORAGE_ROUTE, problem(403));
    const actions = actionsSaving();
    const { user } = await setup(actions);
    await saveWithLogo(user);

    expect(await screen.findByText("Couldn't save. Try again.")).toBeInTheDocument();
    expect(actions.save).not.toHaveBeenCalled();
  });

  it("marks the fields the server rejected and explains each", async () => {
    const { user } = await setup(actionsSaving({ status: "invalid", invalidFields: ["name", "brand"] }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const name = screen.getByRole("textbox", { name: "School name" });
    await waitFor(() => expect(name).toHaveAttribute("aria-invalid", "true"));
    expect(name).toHaveAccessibleDescription("Enter a name of up to 100 characters.");
    expect(screen.getByLabelText("Brand color")).toHaveAccessibleDescription("Pick a color.");
    expect(screen.getByLabelText("Logo")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Settings saved")).not.toBeInTheDocument();
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<SettingsForm school={STAFF_SCHOOL} actions={actionsSaving({ status: "idle", invalidFields: [] })} />, {
      locale: "km",
    });
    expect(await screen.findByRole("textbox", { name: "ឈ្មោះសាលា" })).toBeInTheDocument();
  });
});
