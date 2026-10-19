/** The app's Khmer and Latin font; share images need its glyphs because course titles may be in Khmer. */
const FAMILY = "Kantumruy Pro";
/** Regular for the details, bold for the title. */
const WEIGHTS = [400, 700] as const;
const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2";
/** Where Google's stylesheet names the font file it serves to a client without a browser user agent. */
const FONT_URL = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/;

/** A font as `ImageResponse` takes it. */
export type OgFont = { name: string; data: ArrayBuffer; weight: (typeof WEIGHTS)[number]; style: "normal" };

/**
 * Downloads one weight of the font, cut down to the characters the image shows.
 *
 * @param weight The weight.
 * @param text Every character the image draws.
 * @returns The font file, or null when Google Fonts cannot serve it.
 */
async function loadWeight(weight: OgFont["weight"], text: string): Promise<ArrayBuffer | null> {
  const query = new URLSearchParams({ family: `${FAMILY}:wght@${weight}`, text });
  const css = await fetch(`${GOOGLE_FONTS_CSS}?${query}`);
  const url = css.ok ? FONT_URL.exec(await css.text())?.[1] : undefined;
  if (!url) return null;
  const font = await fetch(url);
  return font.ok ? font.arrayBuffer() : null;
}

/**
 * Loads the fonts a share image draws its text in.
 *
 * @param text Every character the image draws.
 * @returns The weights that loaded. Without them the image falls back to its default Latin font,
 * so a share card still renders when Google Fonts is unreachable; only Khmer letters go missing.
 */
export async function loadOgFonts(text: string): Promise<OgFont[]> {
  const files = await Promise.all(WEIGHTS.map((weight) => loadWeight(weight, text).catch(() => null)));
  return WEIGHTS.flatMap((weight, index) => {
    const data = files[index];
    return data ? [{ name: FAMILY, data, weight, style: "normal" as const }] : [];
  });
}
