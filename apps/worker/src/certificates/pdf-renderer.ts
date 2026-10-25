import type { CertificateDocument, CertificateRenderer } from "@reanit/core/learning";
import { certificateText } from "@reanit/email";
import PDFDocument from "pdfkit";

// Kantumruy Pro covers Khmer and Latin, so names and titles in either print; tsup and Vitest load the files as bytes.
import boldFont from "./fonts/KantumruyPro-Bold.ttf";
import regularFont from "./fonts/KantumruyPro-Regular.ttf";

/** A4 landscape, in PDF points. */
const PAGE = { width: 842, height: 595 } as const;
/** Space between the page edge and the frame, and between the frame and the text. */
const MARGIN = 36;
const FRAME_WIDTH = 2;
const INK = "#1f2937";
const MUTED = "#6b7280";
const ACCENT = "#2563eb";
/** Font sizes, in points. */
const SIZE = { title: 34, name: 30, course: 22, body: 14, footer: 10 } as const;
/** Space above a line, in points: before a new part of the text, between a label and its value, and before none. */
const GAP = { section: 28, label: 16, value: 8, none: 0 } as const;
/** Font names the document registers the files under. */
const REGULAR = "regular";
const BOLD = "bold";

/**
 * Collects a PDFKit document's output once it is ended.
 *
 * @param pdf The document; its content must already be written.
 * @returns The PDF's bytes.
 * @throws {Error} When PDFKit fails to write it.
 */
function finish(pdf: PDFKit.PDFDocument): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    pdf.on("error", reject);
    pdf.end();
  });
}

/**
 * Writes one line centred between the frame's sides, in the given font and size.
 *
 * @param pdf The document.
 * @param text The line.
 * @param style How it looks.
 * @param style.font `REGULAR` or `BOLD`.
 * @param style.size Its size in points.
 * @param style.color Its color.
 * @param style.gap Space above it, in points.
 * @param style.link URL the line opens when clicked, if any.
 */
function centred(
  pdf: PDFKit.PDFDocument,
  text: string,
  { font, size, color, gap, link }: { font: string; size: number; color: string; gap: number; link?: string },
) {
  const left = MARGIN * 2;
  pdf.font(font).fontSize(size).fillColor(color).text(text, left, pdf.y + gap, { width: PAGE.width - left * 2, align: "center", link });
}

/**
 * Draws a certificate on one A4 landscape page: the title, the student's name, the course, the school and
 * date, and a clickable verify link, in the student's language.
 *
 * @param document What the certificate says.
 * @returns The PDF's bytes.
 * @throws {Error} When PDFKit fails to write it.
 */
async function renderCertificate(document: CertificateDocument): Promise<Uint8Array> {
  const text = certificateText(document);
  const pdf = new PDFDocument({
    size: [PAGE.width, PAGE.height],
    margin: 0,
    info: { Title: `${text.title}: ${document.studentName}`, Author: document.schoolName, CreationDate: document.issuedAt },
  });
  pdf.registerFont(REGULAR, regularFont);
  pdf.registerFont(BOLD, boldFont);

  pdf
    .lineWidth(FRAME_WIDTH)
    .strokeColor(ACCENT)
    .rect(MARGIN, MARGIN, PAGE.width - MARGIN * 2, PAGE.height - MARGIN * 2)
    .stroke();
  pdf.y = MARGIN * 3;
  centred(pdf, text.title, { font: BOLD, size: SIZE.title, color: ACCENT, gap: GAP.none });
  centred(pdf, text.presentedTo, { font: REGULAR, size: SIZE.body, color: MUTED, gap: GAP.section });
  centred(pdf, document.studentName, { font: BOLD, size: SIZE.name, color: INK, gap: GAP.value });
  centred(pdf, text.completed, { font: REGULAR, size: SIZE.body, color: MUTED, gap: GAP.label });
  centred(pdf, document.courseTitle, { font: BOLD, size: SIZE.course, color: INK, gap: GAP.value });
  centred(pdf, text.issued, { font: REGULAR, size: SIZE.body, color: INK, gap: GAP.section });

  pdf.y = PAGE.height - MARGIN * 3;
  centred(pdf, text.verify, { font: REGULAR, size: SIZE.footer, color: MUTED, gap: GAP.none });
  centred(pdf, document.verifyUrl, { font: REGULAR, size: SIZE.footer, color: ACCENT, gap: GAP.none, link: document.verifyUrl });
  return finish(pdf);
}

/** `CertificateRenderer` on PDFKit, with Kantumruy Pro for Khmer and Latin text. */
export const pdfCertificateRenderer: CertificateRenderer = { render: renderCertificate };
