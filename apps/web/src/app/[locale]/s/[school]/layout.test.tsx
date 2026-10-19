import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError } from "@/test/navigation";
import { renderWithIntl, routeParams } from "@/test/render";

import SchoolLayout from "./layout";

vi.mock("next/headers", () => import("@/test/headers"));

describe("SchoolLayout", () => {
  it("renders the school's pages in its brand color when the school exists", async () => {
    onApi(
      "GET /schools/by-subdomain/angkor",
      Response.json({ school: { id: "s1", name: "Angkor Academy", subdomain: "angkor" }, owner: { name: null } }),
    );

    renderWithIntl(await SchoolLayout({ children: "School page", params: routeParams({ school: "angkor" }) }));

    expect((await screen.findByText("School page")).style.getPropertyValue("--brand")).toBe("#008b52");
  });

  it("404s when the school does not exist", async () => {
    onApi("GET /schools/by-subdomain/no-such-school", problem(404));

    await expect(SchoolLayout({ children: null, params: routeParams({ school: "no-such-school" }) })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
