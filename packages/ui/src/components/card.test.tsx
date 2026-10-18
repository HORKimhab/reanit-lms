import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card, CardDescription, CardTitle } from "./card";

describe("Card", () => {
  it("renders a titled card with a description", () => {
    render(
      <Card>
        <CardTitle>Students</CardTitle>
        <CardDescription>1,250 enrolled</CardDescription>
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Students" })).toBeInTheDocument();
    expect(screen.getByText("1,250 enrolled")).toBeInTheDocument();
  });

  it("passes native props through to the container", () => {
    render(<Card aria-label="Revenue" role="region" />);
    expect(screen.getByRole("region", { name: "Revenue" })).toBeInTheDocument();
  });
});
