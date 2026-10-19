// @vitest-environment node
import { describe, expect, it } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";

import { loadOgFonts } from "./og-fonts";

const FONT_BYTES = new Uint8Array([0, 1, 0, 0]);

/**
 * Makes Google Fonts serve a stylesheet pointing at a font file, and the file.
 *
 * @param font How the font file answers.
 */
function serveFont(font: Response) {
  onApi("GET /css2", new Response("@font-face { src: url(https://fonts.gstatic.test/s/kantumruy.ttf) format('truetype'); }"));
  onApi("GET /s/kantumruy.ttf", font);
}

describe("loadOgFonts", () => {
  it("loads the regular and bold weights, cut down to the image's text", async () => {
    serveFont(new Response(FONT_BYTES));

    const fonts = await loadOgFonts("វគ្គ Brand");

    expect(fonts.map(({ name, weight, style }) => ({ name, weight, style }))).toEqual([
      { name: "Kantumruy Pro", weight: 400, style: "normal" },
      { name: "Kantumruy Pro", weight: 700, style: "normal" },
    ]);
    expect(new Uint8Array(fonts[0]!.data)).toEqual(FONT_BYTES); // both weights loaded, checked just above
    expect(new URL(requestTo("GET /css2")!.url).searchParams.get("text")).toBe("វគ្គ Brand"); // the stylesheet was requested
  });

  it("loads nothing when Google Fonts refuses the stylesheet", async () => {
    onApi("GET /css2", problem(500));

    expect(await loadOgFonts("Brand")).toEqual([]);
  });

  it("loads nothing when the stylesheet names no font file", async () => {
    onApi("GET /css2", new Response("/* nothing */"));

    expect(await loadOgFonts("Brand")).toEqual([]);
  });

  it("loads nothing when the font file is missing", async () => {
    serveFont(problem(404));

    expect(await loadOgFonts("Brand")).toEqual([]);
  });

  it("loads nothing when the network fails", async () => {
    onApi("GET /css2", () => Promise.reject(new TypeError("fetch failed")));

    expect(await loadOgFonts("Brand")).toEqual([]);
  });
});
