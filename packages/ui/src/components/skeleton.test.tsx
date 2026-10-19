import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("is hidden from assistive tech", () => {
    const { container } = render(<Skeleton className="h-4 w-40" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("passes native props through", () => {
    const { container } = render(<Skeleton data-testid="placeholder" />);
    expect(container.querySelector('[data-testid="placeholder"]')).toBeInTheDocument();
  });
});
