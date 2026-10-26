import type { CustomDomain } from "@reanit/core/schools";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CustomDomainState } from "@/app/[locale]/dashboard/settings/actions";
import { renderWithIntl } from "@/test/render";

import { CustomDomainSection } from "./custom-domain-section";

const DOMAIN: CustomDomain = {
  hostname: "learn.angkor.com",
  status: "awaiting_dns",
  dnsRecords: [
    { type: "TXT", name: "_reanit-verification.learn.angkor.com", value: "reanit-verification=token-1" },
    { type: "CNAME", name: "learn.angkor.com", value: "customers.reanit.com" },
  ],
};

/**
 * Builds a domain step that answers with the given state.
 *
 * @param result - What the step returns.
 * @returns The spy.
 */
function step(result: CustomDomainState) {
  return vi.fn<(state: CustomDomainState, formData: FormData) => Promise<CustomDomainState>>().mockResolvedValue(result);
}

/**
 * Renders the section with action spies.
 *
 * @param settings - Whether domains are offered, and the school's domain.
 * @param settings.isAvailable - Whether domains are offered.
 * @param settings.domain - The school's domain, or null.
 * @param results - What adding and checking answer.
 * @param results.add - Adding's answer.
 * @param results.verify - Checking's answer.
 * @param locale - The UI language.
 * @returns The user-event instance and the spies.
 */
function setup(
  settings: { isAvailable: boolean; domain: CustomDomain | null },
  results: { add?: CustomDomainState; verify?: CustomDomainState } = {},
  locale: "en" | "km" = "en",
) {
  const user = userEvent.setup();
  const actions = {
    add: step(results.add ?? { status: "idle" }),
    verify: step(results.verify ?? { status: "idle" }),
    remove: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
  renderWithIntl(<CustomDomainSection settings={settings} actions={actions} />, { locale });
  return { user, actions };
}

describe("CustomDomainSection", () => {
  it("adds the domain the owner types", async () => {
    const { user, actions } = setup({ isAvailable: true, domain: null });

    await user.type(await screen.findByRole("textbox", { name: "Domain" }), "learn.angkor.com");
    await user.click(screen.getByRole("button", { name: "Add domain" }));

    expect(actions.add.mock.lastCall?.[1].get("hostname")).toBe("learn.angkor.com");
  });

  it.each([
    ["taken", "Another school already uses this domain."],
    ["invalid", "Enter a domain such as learn.yourschool.com, without https:// or a path."],
    ["notAllowed", "This domain belongs to the platform. Use a domain you own."],
    ["planLimit", "Custom domains come with the Pro and Business plans."],
  ] as const)("marks the domain invalid when adding answers %s", async (status, message) => {
    const { user } = setup({ isAvailable: true, domain: null }, { add: { status } });

    await user.type(await screen.findByRole("textbox", { name: "Domain" }), "learn.angkor.com");
    await user.click(screen.getByRole("button", { name: "Add domain" }));

    expect(await screen.findByRole("textbox", { name: "Domain" })).toHaveAccessibleDescription(expect.stringContaining(message));
  });

  it("lists the DNS records to add while the domain awaits them", async () => {
    setup({ isAvailable: true, domain: DOMAIN });

    const table = await screen.findByRole("table", { name: "DNS records to add at your DNS provider" });
    const [, txt, cname] = within(table).getAllByRole("row");
    expect(txt).toHaveTextContent("TXT_reanit-verification.learn.angkor.comreanit-verification=token-1");
    expect(cname).toHaveTextContent("CNAMElearn.angkor.comcustomers.reanit.com");
    expect(screen.getByText(/Waiting for your DNS records/)).toBeInTheDocument();
  });

  it("says when the TXT record is not found yet", async () => {
    const { user, actions } = setup({ isAvailable: true, domain: DOMAIN }, { verify: { status: "notVerified" } });

    await user.click(await screen.findByRole("button", { name: "Check DNS records" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The TXT record was not found yet.");
    expect(actions.verify).toHaveBeenCalledOnce();
  });

  it("shows a live domain without the check button", async () => {
    setup({ isAvailable: true, domain: { ...DOMAIN, status: "active" } });

    expect(await screen.findByText("Live. Students can visit your school on this domain.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check DNS records" })).not.toBeInTheDocument();
  });

  it("explains a certificate that could not be issued", async () => {
    setup({ isAvailable: true, domain: { ...DOMAIN, status: "certificate_failed" } });

    expect(await screen.findByText(/The secure certificate could not be issued/)).toBeInTheDocument();
  });

  it("removes the domain only once the owner confirms", async () => {
    const { user, actions } = setup({ isAvailable: true, domain: { ...DOMAIN, status: "active" } });

    await user.click(await screen.findByRole("button", { name: "Remove domain" }));
    expect(actions.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Remove for good" }));

    expect(actions.remove).toHaveBeenCalledOnce();
  });

  it("says custom domains are unavailable when the platform does not offer them", async () => {
    setup({ isAvailable: false, domain: null });

    expect(await screen.findByText("Custom domains are not available on this platform yet.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Domain" })).not.toBeInTheDocument();
  });

  it("is written in Khmer for km", async () => {
    setup({ isAvailable: true, domain: DOMAIN }, {}, "km");

    expect(await screen.findByRole("heading", { name: "ដែនផ្ទាល់ខ្លួន" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ពិនិត្យកំណត់ត្រា DNS" })).toBeInTheDocument();
  });
});
