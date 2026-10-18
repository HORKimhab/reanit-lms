// @vitest-environment node
// Node's File and FormData, as a server action receives them.
import { revalidatePath } from "next/cache";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MOCK_SCHOOL_SLUG, requireMockSchool, updateMockSchool } from "@/mocks/schools";

import { saveSchoolSettings, type SettingsState } from "./actions";

// Cache revalidation needs a running Next server; it is a boundary, so record calls instead.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const IDLE: SettingsState = { status: "idle", invalidFields: [] };
const ORIGINAL = requireMockSchool(MOCK_SCHOOL_SLUG);
const PNG = new File([new Uint8Array([1, 2, 3])], "logo.png", { type: "image/png" });

/**
 * Builds the settings form's submission.
 *
 * @param fields - Field values to override.
 * @param fields.name - School name; defaults to a valid one.
 * @param fields.brand - Brand color; defaults to a valid one.
 * @param fields.logo - Logo file; defaults to an empty file input.
 * @returns The form data.
 */
function form(fields: { name?: string; brand?: string; logo?: File }) {
  const data = new FormData();
  data.set("name", fields.name ?? "Angkor Studio");
  data.set("brand", fields.brand ?? "#112233");
  data.set("logo", fields.logo ?? new File([], ""));
  return data;
}

afterEach(() => {
  updateMockSchool(MOCK_SCHOOL_SLUG, { name: ORIGINAL.name, brand: ORIGINAL.brand, logoUrl: undefined });
});

describe("saveSchoolSettings", () => {
  it("saves the name, brand and logo and refreshes every layout", async () => {
    expect(await saveSchoolSettings(IDLE, form({ name: "  Angkor Studio ", logo: PNG }))).toEqual({
      status: "saved",
      invalidFields: [],
    });
    expect(requireMockSchool(MOCK_SCHOOL_SLUG)).toMatchObject({
      name: "Angkor Studio",
      brand: "#112233",
      logoUrl: "data:image/png;base64,AQID",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("keeps the current logo when no new file is chosen", async () => {
    await saveSchoolSettings(IDLE, form({ logo: PNG }));
    await saveSchoolSettings(IDLE, form({ name: "Renamed" }));
    expect(requireMockSchool(MOCK_SCHOOL_SLUG)).toMatchObject({ name: "Renamed", logoUrl: "data:image/png;base64,AQID" });
  });

  it.each([
    ["an empty name", { name: "   " }, ["name"]],
    ["a name over 80 characters", { name: "x".repeat(81) }, ["name"]],
    ["a color that is not #rrggbb", { brand: "green" }, ["brand"]],
    ["an SVG logo", { logo: new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }) }, ["logo"]],
    ["an empty name and a bad color", { name: "", brand: "#12" }, ["name", "brand"]],
  ])("rejects %s without saving", async (_case, fields, invalidFields) => {
    expect(await saveSchoolSettings(IDLE, form(fields))).toEqual({ status: "invalid", invalidFields });
    expect(requireMockSchool(MOCK_SCHOOL_SLUG).name).toBe(ORIGINAL.name);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
