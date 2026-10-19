import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPage } from "./status-page";

describe("StatusPage", () => {
  it("shows the status code, a heading, the explanation and the actions", () => {
    render(
      <StatusPage code={404} title="Page not found" text="It moved.">
        <button type="button">Try again</button>
      </StatusPage>,
    );

    expect(screen.getByRole("main")).toHaveTextContent("404");
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("It moved.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
