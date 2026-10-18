import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders a button that calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders its child instead of a button when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/start">Start</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Start" })).toHaveAttribute("href", "/start");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is reachable with the keyboard", async () => {
    render(<Button>Save</Button>);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });
});
