import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderWithIntl, routeParams } from "@/test/render";

import SchoolSiteLayout from "./layout";

vi.mock("next-intl/server", () => import("@/test/intl-server"));

describe("SchoolSiteLayout", () => {
  it("wraps the page in the public header and the school footer", async () => {
    renderWithIntl(await SchoolSiteLayout({ children: "Catalog", params: routeParams({ school: MOCK_SCHOOL_SLUG }) }));
    expect(await screen.findByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Catalog");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("© Angkor Academy");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Powered by Reanit");
  });
});
