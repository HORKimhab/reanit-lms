// @vitest-environment node
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { formData as form } from "@/test/form";
import { RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";
import { STAFF_SCHOOL } from "@/test/staff";

import { saveCertificateTemplate, saveSchoolSettings, startLogoUpload, type SettingsState } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
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

describe("startLogoUpload", () => {
  const UPLOAD_ROUTE = "POST /schools/current/logo-uploads";

  it("returns where to upload the logo", async () => {
    onApi(
      UPLOAD_ROUTE,
      Response.json(
        { key: LOGO_KEY, url: "https://storage.test/a.png", headers: { "content-type": "image/png" }, expiresAt: "2026-10-19T00:15:00.000Z" },
        { status: 201 },
      ),
    );

    expect(await startLogoUpload({ contentType: "image/png", sizeBytes: 2048 })).toEqual({
      status: "ready",
      url: "https://storage.test/a.png",
      headers: { "content-type": "image/png" },
      key: LOGO_KEY,
    });
    expect(await requestTo(UPLOAD_ROUTE)?.json()).toEqual({ contentType: "image/png", sizeBytes: 2048 });
  });

  it.each([415, 413])("rejects the image when the API answers %i", async (status) => {
    onApi(UPLOAD_ROUTE, problem(status));

    expect(await startLogoUpload({ contentType: "image/gif", sizeBytes: 2048 })).toEqual({ status: "rejected" });
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
