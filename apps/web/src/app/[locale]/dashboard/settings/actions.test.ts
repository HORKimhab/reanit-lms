// @vitest-environment node
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { formData as form } from "@/test/form";
import { RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";
import { setTestLocale } from "@/test/intl-server";
import { STAFF_SCHOOL } from "@/test/staff";

import {
  addCustomDomain,
  changeTeamRole,
  inviteTeamMember,
  removeCustomDomain,
  removeTeamMember,
  saveCertificateTemplate,
  saveNotificationPreferences,
  saveSchoolSettings,
  startImageUpload,
  savePaymentQr,
  verifyCustomDomain,
  type CustomDomainState,
  type SettingsState,
} from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));
// Cache revalidation needs a running Next server; it is a boundary, so record calls instead.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const IDLE: SettingsState = { status: "idle", invalidFields: [] };
const ROUTE = "PATCH /schools/current";
const LOGO_KEY = `schools/${STAFF_SCHOOL.id}/logo/a.png`;

beforeEach(() => {
  signIn();
});

describe("saveSchoolSettings", () => {
  it("saves the parsed name and brand color, keeps the logo, and refreshes every layout", async () => {
    onApi(ROUTE, Response.json({ school: STAFF_SCHOOL }));

    expect(await saveSchoolSettings(IDLE, form({ name: "  Angkor Studio ", brand: "#1122AA" }))).toEqual({ status: "saved", invalidFields: [] });
    expect(await requestTo(ROUTE)?.json()).toEqual({ name: "Angkor Studio", brandColor: "#1122aa" });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("sends the key of a newly uploaded logo", async () => {
    onApi(ROUTE, Response.json({ school: STAFF_SCHOOL }));

    await saveSchoolSettings(IDLE, form({ name: "Angkor", brand: "#112233", logoKey: LOGO_KEY }));

    expect(await requestTo(ROUTE)?.json()).toMatchObject({ logoKey: LOGO_KEY });
  });

  it.each([
    ["an empty name", { name: "   ", brand: "#112233" }, ["name"]],
    ["a name over 100 characters", { name: "x".repeat(101), brand: "#112233" }, ["name"]],
    ["a brand that is not a hex color", { name: "Angkor", brand: "green" }, ["brand"]],
    ["both", { name: "", brand: "" }, ["name", "brand"]],
  ])("rejects %s without calling the API", async (_, fields, invalidFields) => {
    expect(await saveSchoolSettings(IDLE, form(fields))).toEqual({ status: "invalid", invalidFields });
    expect(requestTo(ROUTE)).toBeUndefined();
  });

  it.each([
    [400, "urn:reanit:problem:invalid-media-key"],
    [409, "urn:reanit:problem:media-not-uploaded"],
  ])("blames the logo when the API answers %i %s", async (status, type) => {
    onApi(ROUTE, problem(status, type));

    expect(await saveSchoolSettings(IDLE, form({ name: "Angkor", brand: "#112233", logoKey: LOGO_KEY }))).toEqual({
      status: "invalid",
      invalidFields: ["logo"],
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sends a user who runs no school to onboarding", async () => {
    onApi(ROUTE, problem(403, "urn:reanit:problem:not-school-staff"));

    await expect(saveSchoolSettings(IDLE, form({ name: "Angkor", brand: "#112233" }))).rejects.toEqual(new RedirectError("/onboarding"));
  });
});

describe("startImageUpload", () => {
  const UPLOAD_ROUTE = "POST /schools/current/logo-uploads";

  it("returns where to upload the logo", async () => {
    onApi(
      UPLOAD_ROUTE,
      Response.json(
        { key: LOGO_KEY, url: "https://storage.test/a.png", headers: { "content-type": "image/png" }, expiresAt: "2026-10-19T00:15:00.000Z" },
        { status: 201 },
      ),
    );

    expect(await startImageUpload("logo", { contentType: "image/png", sizeBytes: 2048 })).toEqual({
      status: "ready",
      url: "https://storage.test/a.png",
      headers: { "content-type": "image/png" },
      key: LOGO_KEY,
    });
    expect(await requestTo(UPLOAD_ROUTE)?.json()).toEqual({ contentType: "image/png", sizeBytes: 2048 });
  });

  it("asks for a payment QR upload on its own route", async () => {
    onApi("POST /schools/current/payment-qr-uploads", Response.json({ key: "k", url: "https://storage.test/qr.png", headers: {}, expiresAt: "2026-10-19T00:15:00.000Z" }, { status: 201 }));

    expect(await startImageUpload("payment-qr", { contentType: "image/png", sizeBytes: 2048 })).toMatchObject({ status: "ready", key: "k" });
  });

  it.each([415, 413])("rejects the image when the API answers %i", async (status) => {
    onApi(UPLOAD_ROUTE, problem(status));

    expect(await startImageUpload("logo", { contentType: "image/gif", sizeBytes: 2048 })).toEqual({ status: "rejected" });
  });
});

describe("saveCertificateTemplate", () => {
  const TEMPLATE_ROUTE = "PUT /certificates/template";

  it("saves the trimmed signer, with a blank title as null", async () => {
    onApi(TEMPLATE_ROUTE, Response.json({ template: { signerName: "Dara Kim", signerTitle: null } }));

    expect(await saveCertificateTemplate({ status: "idle" }, form({ signerName: " Dara Kim ", signerTitle: "  " }))).toEqual({ status: "saved" });
    expect(await requestTo(TEMPLATE_ROUTE)?.json()).toEqual({ signerName: "Dara Kim", signerTitle: null });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  });

  it("rejects a signer name over the limit without calling the API", async () => {
    expect(await saveCertificateTemplate({ status: "idle" }, form({ signerName: "x".repeat(81), signerTitle: "" }))).toEqual({ status: "invalid" });
    expect(requestTo(TEMPLATE_ROUTE)).toBeUndefined();
  });
});

describe("addCustomDomain", () => {
  const ADD = "POST /schools/current/domain";
  const IDLE_DOMAIN: CustomDomainState = { status: "idle" };

  it("adds the parsed domain and refreshes the settings page", async () => {
    onApi(ADD, Response.json({ domain: {} }, { status: 201 }));

    expect(await addCustomDomain(IDLE_DOMAIN, form({ hostname: " Learn.Angkor.com " }))).toEqual({ status: "idle" });
    expect(await requestTo(ADD)?.json()).toEqual({ hostname: "learn.angkor.com" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  });

  it("refuses a URL without calling the API", async () => {
    expect(await addCustomDomain(IDLE_DOMAIN, form({ hostname: "https://learn.angkor.com/" }))).toEqual({ status: "invalid" });
    expect(requestTo(ADD)).toBeUndefined();
  });

  it.each([
    [400, "domain-not-allowed", "notAllowed"],
    [409, "domain-taken", "taken"],
    [409, "school-has-domain", "hasDomain"],
    [503, "custom-domains-unavailable", "unavailable"],
  ])("answers %i %s with %s", async (status, code, expected) => {
    onApi(ADD, problem(status, `urn:reanit:problem:${code}`));

    expect(await addCustomDomain(IDLE_DOMAIN, form({ hostname: "learn.angkor.com" }))).toEqual({ status: expected });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sends a user who runs no school to onboarding", async () => {
    onApi(ADD, problem(403, "urn:reanit:problem:not-school-staff"));

    await expect(addCustomDomain(IDLE_DOMAIN, form({ hostname: "learn.angkor.com" }))).rejects.toThrow(RedirectError);
  });
});

describe("verifyCustomDomain", () => {
  const VERIFY = "POST /schools/current/domain/verify";

  it("checks the domain and refreshes the settings page", async () => {
    onApi(VERIFY, Response.json({ domain: {} }));

    expect(await verifyCustomDomain()).toEqual({ status: "idle" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  });

  it("says the TXT record is not there yet", async () => {
    onApi(VERIFY, problem(409, "urn:reanit:problem:domain-not-verified"));

    expect(await verifyCustomDomain()).toEqual({ status: "notVerified" });
  });
});

describe("removeCustomDomain", () => {
  const REMOVE = "DELETE /schools/current/domain";

  it.each([204, 404])("refreshes the settings page when the API answers %i", async (status) => {
    onApi(REMOVE, new Response(null, { status }));

    await removeCustomDomain();

    expect(requestTo(REMOVE)).toBeDefined();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  });

  it("sends a signed-out visitor to log in", async () => {
    onApi(REMOVE, problem(401));

    await expect(removeCustomDomain()).rejects.toThrow(RedirectError);
  });
});

describe("saveNotificationPreferences", () => {
  const SAVE = "PUT /notifications/preferences";
  const IDLE_PREFERENCES = { status: "idle" } as const;

  it("saves checked emails as on, missing ones as off, with the language", async () => {
    onApi(SAVE, Response.json({ preferences: {} }));

    expect(await saveNotificationPreferences(IDLE_PREFERENCES, form({ newComment: "on", locale: "km" }))).toEqual({ status: "saved" });
    expect(await requestTo(SAVE)?.json()).toEqual({ newSale: false, newComment: true, courseCompleted: false, locale: "km" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  });

  it("refuses a language emails are not written in without calling the API", async () => {
    expect(await saveNotificationPreferences(IDLE_PREFERENCES, form({ newSale: "on", locale: "fr" }))).toEqual({ status: "invalid" });
    expect(requestTo(SAVE)).toBeUndefined();
  });
});

describe("inviteTeamMember", () => {
  const IDLE_INVITE = { status: "idle" } as const;

  it("invites the email as the role, written in the inviter's language, and refreshes the page", async () => {
    setTestLocale("km");
    onApi("POST /team/invites", Response.json({ invite: {} }, { status: 201 }));

    expect(await inviteTeamMember(IDLE_INVITE, form({ email: "Chenda@Example.com", role: "admin" }))).toEqual({ status: "sent" });
    expect(await requestTo("POST /team/invites")?.json()).toEqual({ email: "chenda@example.com", role: "admin", locale: "km" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  });

  it("refuses a malformed email without asking the API", async () => {
    expect(await inviteTeamMember(IDLE_INVITE, form({ email: "nope", role: "admin" }))).toEqual({ status: "invalid" });
    expect(requestTo("POST /team/invites")).toBeUndefined();
  });

  it("says when the email already belongs to the team", async () => {
    onApi("POST /team/invites", problem(409, "urn:reanit:problem:already-team-member"));

    expect(await inviteTeamMember(IDLE_INVITE, form({ email: "vibol@example.com", role: "instructor" }))).toEqual({ status: "member" });
  });
});

describe("changeTeamRole", () => {
  it("saves the member's new role and refreshes the page", async () => {
    const id = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a61";
    onApi(`PATCH /team/members/${id}`, Response.json({ member: {} }));

    await changeTeamRole(id, form({ role: "admin" }));

    expect(await requestTo(`PATCH /team/members/${id}`)?.json()).toEqual({ role: "admin" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  });
});

describe("removeTeamMember", () => {
  const ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a61";

  it.each([204, 404])("removes the member, counting one already gone (%i) as removed", async (status) => {
    onApi(`DELETE /team/members/${ID}`, status === 204 ? new Response(null, { status }) : problem(status));

    await removeTeamMember(ID);

    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  });

  it("throws when the API refuses, e.g. for the owner", async () => {
    onApi(`DELETE /team/members/${ID}`, problem(409, "urn:reanit:problem:owner-locked"));

    await expect(removeTeamMember(ID)).rejects.toThrow("API answered 409");
  });
});

describe("savePaymentQr", () => {
  const QR_KEY = `schools/${STAFF_SCHOOL.id}/payment-qr/qr.png`;

  /**
   * Answers the staff school lookup and the settings save.
   *
   * @param answer - The settings save's response.
   */
  function answer(answer: Response) {
    onApi("GET /schools/current", Response.json({ school: STAFF_SCHOOL, role: "owner" }));
    onApi(ROUTE, answer);
  }

  it("saves the payment QR key, keeping the school's name and brand color, and refreshes the page", async () => {
    answer(Response.json({ school: STAFF_SCHOOL }));

    expect(await savePaymentQr({ status: "idle" }, form({ paymentQrKey: QR_KEY }))).toEqual({ status: "saved" });
    expect(await requestTo(ROUTE)?.json()).toEqual({ name: STAFF_SCHOOL.name, brandColor: STAFF_SCHOOL.brandColor, paymentQrKey: QR_KEY });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  });

  it("removes the payment QR for an empty key", async () => {
    answer(Response.json({ school: STAFF_SCHOOL }));

    await savePaymentQr({ status: "idle" }, form({ paymentQrKey: "" }));

    expect(await requestTo(ROUTE)?.json()).toMatchObject({ paymentQrKey: null });
  });

  it("reports a key the API refuses", async () => {
    answer(problem(400, "urn:reanit:problem:invalid-media-key"));

    expect(await savePaymentQr({ status: "idle" }, form({ paymentQrKey: "schools/other/payment-qr/qr.png" }))).toEqual({ status: "invalid" });
  });
});

