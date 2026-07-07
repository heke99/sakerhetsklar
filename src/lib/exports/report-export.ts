import "server-only";

import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface ReportExportField {
  label: string;
  value: string;
}

export interface ReportExportData {
  title: string;
  subtitle: string;
  organizationName: string;
  reference: string;
  generatedAt: Date;
  fields: ReportExportField[];
  footer: string;
}

export async function generateReportDocx(data: ReportExportData): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: data.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: data.subtitle, heading: HeadingLevel.HEADING_2 }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${data.organizationName} · ${data.reference} · Genererad ${data.generatedAt.toLocaleString("sv-SE")}`,
          italics: true,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
  ];

  for (const field of data.fields) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: field.label, bold: true })],
        spacing: { before: 200 },
      }),
      new Paragraph({ text: field.value || "—" }),
    );
  }

  children.push(
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [new TextRun({ text: data.footer, italics: true, size: 18 })],
    }),
  );

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

export async function generateReportPdf(data: ReportExportData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const margin = 50;
  const width = pageSize[0] - margin * 2;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  // pdf-lib's standard fonts are Latin-1; strip unsupported characters.
  const sanitize = (text: string) =>
    text.replace(/[^\x20-\x7EåäöÅÄÖéÉüÜ§–—""'']/g, "?");

  const wrap = (text: string, size: number, fnt = font): string[] => {
    const words = sanitize(text).split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (fnt.widthOfTextAtSize(candidate, size) > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const writeLine = (text: string, size: number, fnt = font, color = rgb(0, 0, 0)) => {
    for (const line of wrap(text, size, fnt)) {
      if (y < margin + size) {
        page = pdf.addPage(pageSize);
        y = pageSize[1] - margin;
      }
      page.drawText(line, { x: margin, y, size, font: fnt, color });
      y -= size * 1.45;
    }
  };

  writeLine(data.title, 18, bold);
  writeLine(data.subtitle, 13, bold, rgb(0.25, 0.25, 0.25));
  writeLine(
    `${data.organizationName} · ${data.reference} · Genererad ${data.generatedAt.toLocaleString("sv-SE")}`,
    9,
    font,
    rgb(0.4, 0.4, 0.4),
  );
  y -= 10;

  for (const field of data.fields) {
    y -= 6;
    writeLine(field.label, 10, bold);
    writeLine(field.value || "—", 10);
  }

  y -= 14;
  writeLine(data.footer, 8, font, rgb(0.4, 0.4, 0.4));

  return Buffer.from(await pdf.save());
}
