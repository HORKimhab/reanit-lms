import type { Team } from "@reanit/core/schools";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { TeamSection } from "./team-section";

const NOW = new Date("2026-10-26T12:00:00Z");
const OWNER = { id: "user-owner", name: "Sokha Chan", email: "sokha@example.com", role: "owner", joinedAt: new Date("2026-01-01T00:00:00Z") } as const;
const VIBOL = { id: "user-vibol", name: null, email: "vibol@example.com", role: "instructor", joinedAt: new Date("2026-10-01T00:00:00Z") } as const;
const TEAM: Team = {
  members: [OWNER, VIBOL],
  invites: [
    { id: "invite-open", email: "chenda@example.com", role: "admin", expiresAt: new Date("2026-11-02T12:00:00Z"), createdAt: NOW },
    { id: "invite-old", email: "old@example.com", role: "instructor", expiresAt: new Date("2026-10-20T12:00:00Z"), createdAt: NOW },
  ],
};

/**
 * Renders the section with spies for its actions.
 *
 * @param team - The team to show.
 * @returns The action spies.
 */
async function render(team: Team = TEAM) {
  const actions = {
    invite: vi.fn().mockResolvedValue({ status: "idle" }),
    changeRole: vi.fn<(userId: string, formData: FormData) => Promise<void>>().mockResolvedValue(undefined),
    remove: vi.fn<(userId: string) => Promise<void>>().mockResolvedValue(undefined),
  };
  renderWithIntl(<TeamSection team={team} now={NOW} actions={actions} />);
  await screen.findByRole("region", { name: "Team" });
  return actions;
}

describe("TeamSection", () => {
  it("lists the owner with a fixed role and the others with their role to change", async () => {
    await render();

    const [, ownerRow, vibolRow] = within(screen.getByRole("table", { name: "Team members" })).getAllByRole("row");
    expect(ownerRow).toHaveTextContent("Sokha Chan");
    expect(ownerRow).toHaveTextContent("Owner");
    expect(within(ownerRow!).queryByRole("button")).not.toBeInTheDocument(); // the table has the owner's row
    expect(within(vibolRow!).getByRole("combobox", { name: "Role of vibol@example.com" })).toHaveValue("instructor"); // and Vibol's
  });

  it("changes a member's role", async () => {
    const user = userEvent.setup();
    const actions = await render();

    await user.selectOptions(screen.getByRole("combobox", { name: "Role of vibol@example.com" }), "Admin");
    await user.click(screen.getByRole("button", { name: "Change role" }));

    expect(actions.changeRole).toHaveBeenCalledWith("user-vibol", expect.any(FormData));
    expect((actions.changeRole.mock.calls[0]?.[1] as FormData).get("role")).toBe("admin");
  });

  it("removes a member only after confirming", async () => {
    const user = userEvent.setup();
    const actions = await render();

    await user.click(screen.getByRole("button", { name: "Remove from team" }));
    expect(screen.getByRole("alert")).toHaveTextContent("vibol@example.com will lose access to the dashboard.");
    expect(actions.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(actions.remove).toHaveBeenCalledWith("user-vibol");
  });

  it("lists the invites waiting for an answer, marking expired ones", async () => {
    await render();

    const [, open, old] = within(screen.getByRole("table", { name: "Invites waiting for an answer" })).getAllByRole("row");
    expect(open).toHaveTextContent("chenda@example.com");
    expect(open).toHaveTextContent("Admin");
    expect(open).not.toHaveTextContent("Expired");
    expect(old).toHaveTextContent("Expired");
  });

  it("shows no invites table when nobody is invited", async () => {
    await render({ ...TEAM, invites: [] });

    expect(screen.queryByRole("table", { name: "Invites waiting for an answer" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invite" })).toBeInTheDocument();
  });
});
