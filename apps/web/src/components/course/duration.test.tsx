import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { Duration } from "./duration";

describe("Duration", () => {
  it("shows minutes when under an hour", async () => {
    renderWithIntl(<Duration seconds={240} />);
    expect(await screen.findByText("4 min")).toBeInTheDocument();
  });

  it("shows hours and minutes when an hour or longer", async () => {
    renderWithIntl(<Duration seconds={3900} />);
    expect(await screen.findByText("1 h 5 min")).toBeInTheDocument();
  });

  it("rounds up to one minute when shorter than a minute", async () => {
    renderWithIntl(<Duration seconds={20} />);
    expect(await screen.findByText("1 min")).toBeInTheDocument();
  });

  it("shows nothing when the duration is zero", () => {
    const { container } = renderWithIntl(<Duration seconds={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses Khmer units when the locale is km", async () => {
    renderWithIntl(<Duration seconds={3900} />, { locale: "km" });
    expect(await screen.findByText("1 ម៉ោង 5 នាទី")).toBeInTheDocument();
  });
});
