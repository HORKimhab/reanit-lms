import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { AuthPanel, OrDivider } from "./auth-panel";

describe("AuthPanel", () => {
  it("titles the log-in page and links to sign-up, keeping next", async () => {
    renderWithIntl(<AuthPanel mode="logIn" next="/s/angkor/my-courses">forms</AuthPanel>);

    expect(await screen.findByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/signup?next=%2Fs%2Fangkor%2Fmy-courses",
    );
    expect(screen.getByText("forms")).toBeInTheDocument();
  });

  it("links from sign-up to log-in without next when there is none", async () => {
    renderWithIntl(<AuthPanel mode="signUp">forms</AuthPanel>);

    expect(await screen.findByRole("heading", { level: 1, name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });

  it("alerts when the magic link was invalid", async () => {
    renderWithIntl(<AuthPanel mode="logIn" error="invalid-link">forms</AuthPanel>);

    expect(await screen.findByRole("alert")).toHaveTextContent("That sign-in link is invalid or has expired.");
  });

  it.each([["unknown"], [["invalid-link", "invalid-link"]], ["toString"]])("ignores the error %j", async (error) => {
    renderWithIntl(<AuthPanel mode="logIn" error={error}>forms</AuthPanel>);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("OrDivider", () => {
  it("separates the forms with a localized label", async () => {
    renderWithIntl(<OrDivider />, { locale: "km" });

    expect(await screen.findByRole("separator")).toHaveTextContent("ឬ");
  });
});
