import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import ErrorPage from "./error";

describe("ErrorPage", () => {
  it("lets the visitor try again or go home", async () => {
    const reset = vi.fn();
    renderWithIntl(<ErrorPage error={new Error("boom")} reset={reset} />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
  });

  it("shows the reference that matches the server's log, and never the error's message", async () => {
    renderWithIntl(<ErrorPage error={Object.assign(new Error("SQL details"), { digest: "123456" })} reset={vi.fn()} />);

    expect(await screen.findByText("Reference: 123456")).toBeInTheDocument();
    expect(screen.queryByText(/SQL details/)).not.toBeInTheDocument();
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<ErrorPage error={new Error("boom")} reset={vi.fn()} />, { locale: "km" });

    expect(await screen.findByRole("button", { name: "ព្យាយាមម្ដងទៀត" })).toBeInTheDocument();
  });
});
