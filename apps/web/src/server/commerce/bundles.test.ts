// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { BUNDLE } from "@/test/bundles";
import { NotFoundError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { getSiteBundle, getStaffBundle, listStaffBundles } from "./bundles";

vi.mock("next/headers", () => import("@/test/headers"));

beforeEach(() => {
  signIn();
});

describe("staff bundles", () => {
  it("lists the school's bundles", async () => {
    onApi("GET /bundles", Response.json({ bundles: [BUNDLE] }));

    expect(await listStaffBundles()).toEqual([BUNDLE]);
  });

  it("loads a bundle by slug and 404s on an unknown one", async () => {
    onApi("GET /bundles/by-slug/design-kit", Response.json({ bundle: BUNDLE }));
    onApi("GET /bundles/by-slug/missing", problem(404));

    expect(await getStaffBundle("design-kit")).toEqual(BUNDLE);
    await expect(getStaffBundle("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getSiteBundle", () => {
  it("loads a published bundle and 404s on a draft or missing one", async () => {
    onApi("GET /schools/by-subdomain/angkor/bundles/design-kit", Response.json({ bundle: BUNDLE }));
    onApi("GET /schools/by-subdomain/angkor/bundles/draft", problem(404));

    expect(await getSiteBundle("angkor", "design-kit")).toEqual(BUNDLE);
    await expect(getSiteBundle("angkor", "draft")).rejects.toBeInstanceOf(NotFoundError);
  });
});
