import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatTile } from "./stat-tile";

describe("StatTile", () => {
  it("pairs the label with its figure as a term and definition", () => {
    render(
      <dl>
        <StatTile label="Students">182</StatTile>
      </dl>,
    );
    expect(screen.getByRole("term")).toHaveTextContent("Students");
    expect(screen.getByRole("definition")).toHaveTextContent("182");
  });
});
