import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { NotificationPreferencesState } from "@/app/[locale]/dashboard/settings/actions";
import { renderWithIntl } from "@/test/render";

import { NotificationPreferencesForm } from "./notification-preferences-form";

const PREFERENCES = { newSale: true, newComment: false, courseCompleted: true, locale: "en" } as const;
const EVERY_KIND = ["newSale", "newComment", "courseCompleted"] as const;

/**
 * Builds a save action that answers with the given state.
 *
 * @param result - What saving returns.
 * @returns The spy.
 */
function saving(result: NotificationPreferencesState) {
  return vi.fn<(state: NotificationPreferencesState, formData: FormData) => Promise<NotificationPreferencesState>>().mockResolvedValue(result);
}

describe("NotificationPreferencesForm", () => {
  it("shows the saved settings and sends what the staff member changes", async () => {
    const user = userEvent.setup();
    const save = saving({ status: "saved" });
    renderWithIntl(<NotificationPreferencesForm preferences={PREFERENCES} kinds={EVERY_KIND} save={save} />);
    const comments = await screen.findByRole("checkbox", { name: /A student comments/ });
    expect(comments).not.toBeChecked();

    await user.click(comments);
    await user.click(screen.getByRole("checkbox", { name: /A sale is made/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Email language" }), "km");
    await user.click(screen.getByRole("button", { name: "Save email settings" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Email settings saved");
    const formData = save.mock.lastCall?.[1];
    expect([formData?.get("newSale"), formData?.get("newComment"), formData?.get("courseCompleted"), formData?.get("locale")]).toEqual([null, "on", "on", "km"]);
  });

  it("keeps an email the role does not get as it was saved", async () => {
    const user = userEvent.setup();
    const save = saving({ status: "saved" });
    renderWithIntl(<NotificationPreferencesForm preferences={PREFERENCES} kinds={["newComment", "courseCompleted"]} save={save} />);
    expect(await screen.findByRole("checkbox", { name: /A student comments/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /A sale is made/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save email settings" }));

    expect(save.mock.lastCall?.[1].get("newSale")).toBe("on");
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<NotificationPreferencesForm preferences={PREFERENCES} kinds={EVERY_KIND} save={saving({ status: "idle" })} />, { locale: "km" });

    expect(await screen.findByRole("heading", { name: "ការជូនដំណឹងតាមអ៊ីមែល" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /មានការលក់/ })).toBeChecked();
  });
});
