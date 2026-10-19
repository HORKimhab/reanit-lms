/** Text colors of the card: it is always light, whatever the visitor's theme. */
const INK = "#09090b";
const MUTED = "#52525b";

/**
 * A course's share card, drawn into a PNG by `ImageResponse` (Satori): only flex layout and inline
 * styles, every element with text set to `display: flex`.
 *
 * @param props - Component props.
 * @param props.title - The course title.
 * @param props.schoolName - The school selling it.
 * @param props.details - A short line under the title, such as the lesson count.
 * @param props.brand - The school's brand color, `#rrggbb`.
 * @returns The card, filling the image.
 */
export function CourseOgImage({ title, schoolName, details, brand }: { title: string; schoolName: string; details: string; brand: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        backgroundColor: "#ffffff",
        borderTop: `24px solid ${brand}`,
        fontFamily: "Kantumruy Pro",
      }}
    >
      <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: brand }}>{schoolName}</div>
      <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.2, color: INK }}>{title}</div>
      <div style={{ display: "flex", fontSize: 32, color: MUTED }}>{details}</div>
    </div>
  );
}
