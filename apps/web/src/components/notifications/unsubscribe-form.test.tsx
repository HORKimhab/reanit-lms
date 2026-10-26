import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { UnsubscribeState } from "@/app/[locale]/(auth)/unsubscribe/actions";
import { renderWithIntl } from "@/test/render";

import { UnsubscribeForm } from "./unsubscribe-form";

const LINK = { token: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01", kind: "newComment" } as const;

/**
 * Builds an unsubscribe action that answers with the given state.
 *
 * @param result - What unsubscribing returns.
 * @returns The spy.
 */
function answering(result: UnsubscribeState) {
  return vi.fn<(state: UnsubscribeState, formData: FormData) => Promise<UnsubscribeState>>().mockResolvedValue(result);
}

describe("UnsubscribeForm", () => {
  it("stops the emails only once the reader confirms, then says from which school", async () => {
    const user = userEvent.setup();
    const action = answering({ status: "done", schoolName: "Angkor Academy" });
    renderWithIntl(<UnsubscribeForm link={LINK} action={action} />);
    expect(await screen.findByRole("heading", { name: "Stop emails about new comments?" })).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Stop these emails" }));

    expect(await screen.findByRole("status")).toHaveTextContent("You won't get emails about new comments from Angkor Academy anymore.");
    const formData = action.mock.lastCall?.[1];
    expect([formData?.get("token"), formData?.get("kind")]).toEqual([LINK.token, LINK.kind]);
  });

  it("says the link does not work when the API does not know it", async () => {
    const user = userEvent.setup();
    renderWithIntl(<UnsubscribeForm link={LINK} action={answering({ status: "invalid" })} />);

    await user.click(await screen.findByRole("button", { name: "Stop these emails" }));

    expect(await screen.findByRole("heading", { name: "This link doesn't work" })).toBeInTheDocument();
  });

  it("says the link does not work when it is malformed, offering no button", async () => {
    renderWithIntl(<UnsubscribeForm link={null} action={answering({ status: "idle" })} />);

    expect(await screen.findByRole("heading", { name: "This link doesn't work" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<UnsubscribeForm link={LINK} action={answering({ status: "idle" })} />, { locale: "km" });

    expect(await screen.findByRole("button", { name: "ឈប់ទទួលអ៊ីមែលទាំងនេះ" })).toBeInTheDocument();
  });
});
