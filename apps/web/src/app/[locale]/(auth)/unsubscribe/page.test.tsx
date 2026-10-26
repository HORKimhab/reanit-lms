import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import UnsubscribePage from "./page";

vi.mock("next-intl/server", () => import("@/test/intl-server"));

/**
 * Renders the page for a link's query.
 *
 * @param query - The link's search params.
 */
async function visit(query: Record<string, string>) {
  renderWithIntl(await UnsubscribePage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve(query) }));
}

// The page only parses the link and composes UnsubscribeForm, which has its own tests; its parse branch is tested here.
describe("UnsubscribePage", () => {
  it("asks to confirm a well-formed link", async () => {
    await visit({ token: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01", kind: "courseCompleted" });

    expect(await screen.findByRole("heading", { name: "Stop emails about completed courses?" })).toBeInTheDocument();
  });

  it("says a link with a bad token does not work", async () => {
    await visit({ token: "nope", kind: "courseCompleted" });

    expect(await screen.findByRole("heading", { name: "This link doesn't work" })).toBeInTheDocument();
  });
});
