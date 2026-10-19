import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { Pager } from "./pager";

describe("Pager", () => {
  it("links to the pages on both sides of a middle page", async () => {
    renderWithIntl(<Pager label="Results" page={2} pages={3} hrefFor={(page) => `/results?page=${page}`} />);

    expect(await screen.findByRole("navigation", { name: "Results" })).toHaveTextContent("Page 2 of 3");
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/results?page=1");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/results?page=3");
  });

  it("offers no links past the first or last page", async () => {
    renderWithIntl(<Pager label="Results" page={1} pages={1} hrefFor={(page) => `/results?page=${page}`} />);

    await screen.findByRole("navigation", { name: "Results" });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
