import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { SettingsSection } from "./settings-section";

describe("SettingsSection", () => {
  it("labels the section with its heading and keeps its id for links", async () => {
    renderWithIntl(
      <SettingsSection id="notifications" title="Email notifications" intro="Choose your emails.">
        <p>Form</p>
      </SettingsSection>,
    );

    const section = await screen.findByRole("region", { name: "Email notifications" });
    expect(section).toHaveAttribute("id", "notifications");
    expect(section).toHaveTextContent("Choose your emails.Form");
  });
});
