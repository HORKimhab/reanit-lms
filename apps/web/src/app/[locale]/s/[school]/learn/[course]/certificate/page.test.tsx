// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { RedirectError } from "@/test/navigation";
import { routeProps } from "@/test/render";
import { signIn } from "@/test/session";

import CertificateDownload from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const ROUTE = "GET /schools/by-subdomain/angkor/learn/brand-design-basics/certificate";
const PROPS = routeProps({ school: "angkor", course: "brand-design-basics" });

describe("CertificateDownload", () => {
  it("redirects to the signed certificate PDF", async () => {
    signIn();
    onApi(ROUTE, Response.json({ url: "https://storage.test/cert.pdf?signed", expiresAt: "2026-10-25T08:05:00.000Z" }));

    await expect(CertificateDownload(PROPS)).rejects.toEqual(new RedirectError("https://storage.test/cert.pdf?signed"));
  });

  it("says the certificate is on its way while its PDF is being made", async () => {
    signIn();
    onApi(ROUTE, problem(404));

    const html = renderToStaticMarkup(await CertificateDownload(PROPS));

    expect(html).toContain("Your certificate is on its way");
  });
});
