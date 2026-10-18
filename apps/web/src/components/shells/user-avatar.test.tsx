import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserAvatar } from "./user-avatar";

describe("UserAvatar", () => {
  it("shows the user's initials, labelled with their name", () => {
    render(<UserAvatar />);
    expect(screen.getByRole("img", { name: "Sokha Chan" })).toHaveTextContent("SC");
  });
});
