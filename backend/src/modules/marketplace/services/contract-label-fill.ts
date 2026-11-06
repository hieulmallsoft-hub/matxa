import { PDFDocument, PDFFont, rgb } from 'pdf-lib';

/** One text line of the template as the PDF draws it: where it starts, how wide and tall it is. */
type TextLine = { page: number; text: string; x: number; y: number; width: number; height: number };

/** What goes on the dotted lines of a template written like "Bên A: ........". */
export type ContractLabelValues = {
  contractNumber: string | null;
  day: string;
  month: string;
  year: string;
  fullName: string | null;
  idNumber: string | null;
  issueDate: string | null;
  issuePlace: string | null;
  address: string | null;
  phone: string | null;
};

/** Lines of the first pages, read with pdf.js (text and position only, nothing is rendered). */
export async function readTemplateLines(template: Uint8Array, pages = 2): Promise<TextLine[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(template), disableFontFace: true, verbosity: 0 }).promise;
  const lines: TextLine[] = [];
  for (let index = 1; index <= Math.min(pages, doc.numPages); index++) {
    const content = await (await doc.getPage(index)).getTextContent();
    for (const item of content.items as Array<{ str: string; transform: number[]; width: number; height: number }>) {
      if (item.str?.trim()) lines.push({ page: index - 1, text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height });
    }
  }
  await doc.destroy();
  return lines;
}

/**
 * Writes the applicant's details over the dotted blanks that follow the usual labels of the contract template, so an
 * ordinary PDF (no form fields) comes out filled. Only Bên A's block is touched: lines between "Bên A:" and "Bên B".
 * Returns how many blanks were filled.
 */
export function fillLabelledBlanks(pdf: PDFDocument, fonts: PDFFont[], lines: TextLine[], values: ContractLabelValues) {
  const rules: Array<{ label: RegExp; partyA?: boolean; values: Array<string | null> }> = [
    { label: /^Số\s*:/, values: [values.contractNumber] },
    // The year blank is "20...": the whole "20..." is replaced by the full year, which reads better than a squeezed "26".
    { label: /^Hôm nay,\s*ngày/, values: [values.day, values.month, values.year] },
    { label: /^Bên A\s*:/, values: [values.fullName] },
    { label: /^(CCCD|CMND|Căn cước)[^:]*:/i, partyA: true, values: [values.idNumber] },
    { label: /^Ngày cấp\s*:/, partyA: true, values: [values.issueDate] },
    { label: /^Nơi cấp\s*:/, partyA: true, values: [values.issuePlace] },
    { label: /^Địa chỉ\s*:/, partyA: true, values: [values.address] },
    { label: /^Số điện thoại\s*:/, partyA: true, values: [values.phone] },
  ];
  const partyA = lines.findIndex((line) => /^Bên A\s*:/.test(line.text.trim()));
  const partyB = lines.findIndex((line, index) => index > partyA && /^Bên B\s*:/.test(line.text.trim()));
  const used = new Set<RegExp>();
  let filled = 0;
  lines.forEach((line, index) => {
    const text = line.text.trim();
    const rule = rules.find((candidate) => !used.has(candidate.label) && candidate.label.test(text));
    if (!rule) return;
    if (rule.partyA && (partyA < 0 || index < partyA || (partyB >= 0 && index > partyB))) return;
    used.add(rule.label);
    const page = pdf.getPage(line.page);
    const size = line.height || 9;
    // The template is set in DejaVu like our fonts; the weight whose width matches the line is the one it uses
    // (a whole line such as "Bên A: ....." is bold), so positions measured with it land on the dots.
    const font = fonts.reduce((best, candidate) =>
      Math.abs(candidate.widthOfTextAtSize(line.text, size) - line.width) < Math.abs(best.widthOfTextAtSize(line.text, size) - line.width)
        ? candidate
        : best,
    );
    const fullWidth = font.widthOfTextAtSize(line.text, size) || 1;
    const at = (offset: number) => line.x + (line.width * font.widthOfTextAtSize(line.text.slice(0, offset), size)) / fullWidth;
    // A blank starts at its first dot, so the space after the label stays.
    const blanks = [...line.text.matchAll(/\.(?:\s*\.){2,}|…+/g)];
    blanks.forEach((blank, position) => {
      const value = rule.values[position]?.trim();
      if (!value) return;
      const yearPrefix = /^\d{4}$/.test(value) && line.text.slice(0, blank.index).endsWith('20') ? 2 : 0;
      const start = at(blank.index! - yearPrefix);
      const end = at(blank.index! + blank[0].length);
      const room = end - start - 2;
      page.drawRectangle({ x: start, y: line.y - size * 0.3, width: end - start, height: size * 1.3, color: rgb(1, 1, 1) });
      const fit = Math.max(5, Math.min(size, (room / (font.widthOfTextAtSize(value, 1) || 1))));
      page.drawText(value, { x: start + 1, y: line.y, size: fit, font, color: rgb(0.05, 0.05, 0.05) });
      filled++;
    });
  });
  return filled;
}
