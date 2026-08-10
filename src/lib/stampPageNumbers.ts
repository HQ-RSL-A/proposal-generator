import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Stamps "Page N of M" centered on every page's footer baseline, AFTER react-pdf
 * has rendered. react-pdf's own numbering (a fixed Text with a render callback)
 * corrupts this document's layout ("unsupported number" — reproduced standalone
 * AND nested, see ProposalPdf's PageFooter comment), so numbering happens here,
 * on the finished bytes, where layout can no longer be disturbed.
 *
 * Geometry mirrors the footer: 7.5pt, FAINT #9CA3AF, baseline ~28pt from the
 * page bottom (the footer row's `bottom: 28`). Helvetica at this size is
 * visually interchangeable with the footer's Inter and needs no font embedding.
 */
export async function stampPageNumbers(pdfBytes: Uint8Array | Buffer): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  const size = 7.5;
  const faint = rgb(156 / 255, 163 / 255, 175 / 255); // FAINT #9CA3AF

  pages.forEach((page, i) => {
    const label = `Page ${i + 1} of ${total}`;
    const width = font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: (page.getWidth() - width) / 2,
      y: 30,
      size,
      font,
      color: faint,
    });
  });

  return Buffer.from(await doc.save());
}
