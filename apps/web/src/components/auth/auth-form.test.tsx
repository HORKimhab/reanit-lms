import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AuthFormState } from "@/app/[locale]/(auth)/actions";
import { renderWithIntl } from "@/test/render";

import { AuthForm } from "./auth-form";

type Action = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;

/**
 * Builds an auth action that always answers with the given result.
 *
 * @param status - Result status.
 * @param invalidFields - Fields the result marks invalid.
 * @returns The spy.
 */
function actionReturning(status: AuthFormState["status"], invalidFields: string[] = []) {
  return vi.fn<Action>().mockResolvedValue({ status, invalidFields });
}

/**
 * Submits the form with the given button.
 *
 * @param name - The submit button's accessible name.
 */
async function submit(name: string) {
  await userEvent.click(screen.getByRole("button", { name }));
}

describe("AuthForm", () => {
  it("submits email, password and next when logging in", async () => {
    const action = actionReturning("idle");
    renderWithIntl(<AuthForm mode="logIn" action={action} next="/dashboard" />);

    await userEvent.type(await screen.findByLabelText("Email"), "dara@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse");
    await submit("Log in");

    const formData = action.mock.calls[0]![1]; // submitted once above
    expect(Object.fromEntries(formData)).toEqual({ next: "/dashboard", email: "dara@example.com", password: "correct horse" });
  });

  it("asks for name, email and a new password when signing up", async () => {
    renderWithIntl(<AuthForm mode="signUp" action={actionReturning("idle")} passwordRules={{ min: 8, max: 128 }} />);

    expect(await screen.findByLabelText("Name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Password")).toHaveAttribute("minlength", "8");
  });

  it("asks only for email in magic-link mode", async () => {
    renderWithIntl(<AuthForm mode="magicLink" action={actionReturning("idle")} />);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Email me a sign-in link" })).toBeInTheDocument();
  });

  it("leaves next out when there is none", async () => {
    const action = actionReturning("idle");
    renderWithIntl(<AuthForm mode="magicLink" action={action} />);

    await submit("Email me a sign-in link");

    expect(action.mock.calls[0]![1].has("next")).toBe(false); // submitted once above
  });

  it("marks each invalid field with its message", async () => {
    renderWithIntl(<AuthForm mode="logIn" action={actionReturning("invalid", ["email", "password"])} />);

    await submit("Log in");

    expect(await screen.findByLabelText("Email")).toHaveAccessibleDescription("Enter a valid email address.");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password.");
  });

  it("explains the password length rule on sign-up", async () => {
    renderWithIntl(
      <AuthForm mode="signUp" action={actionReturning("invalid", ["password"])} passwordRules={{ min: 8, max: 128 }} />,
    );

    await submit("Create account");

    expect(await screen.findByLabelText("Password")).toHaveAccessibleDescription("Use 8 to 128 characters.");
  });

  it("says the email is taken under the email field", async () => {
    renderWithIntl(
      <AuthForm mode="signUp" action={actionReturning("emailTaken", ["email"])} passwordRules={{ min: 8, max: 128 }} />,
    );

    await submit("Create account");

    expect(await screen.findByLabelText("Email")).toHaveAccessibleDescription(
      "An account with this email already exists. Log in instead.",
    );
  });

  it("alerts that the email or password is incorrect", async () => {
    renderWithIntl(<AuthForm mode="logIn" action={actionReturning("invalidCredentials")} />);

    await submit("Log in");

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
  });

  it("confirms that the sign-in link was sent", async () => {
    renderWithIntl(<AuthForm mode="magicLink" action={actionReturning("sent")} />);

    await submit("Email me a sign-in link");

    expect(await screen.findByRole("status")).toHaveTextContent("Check your inbox for a sign-in link.");
  });

  it("disables the button while submitting", async () => {
    const action = vi.fn<Action>(() => new Promise(() => {}));
    renderWithIntl(<AuthForm mode="logIn" action={action} />);

    await submit("Log in");

    expect(await screen.findByRole("button", { name: "Please wait…" })).toBeDisabled();
  });

  it("speaks Khmer in the km locale", async () => {
    renderWithIntl(<AuthForm mode="logIn" action={actionReturning("idle")} />, { locale: "km" });

    expect(await screen.findByLabelText("អ៊ីមែល")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ចូលគណនី" })).toBeInTheDocument();
  });
});
