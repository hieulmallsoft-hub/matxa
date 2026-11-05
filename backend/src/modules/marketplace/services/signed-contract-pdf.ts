import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import * as fontkitModule from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, PDFTextField, rgb } from 'pdf-lib';

export type SignedContractInfo = {
  /** Null on a preview before the first signing: the number is issued when the technician signs. */
  contractNumber: string | null;
  displayName: string | null;
  idCardNumber: string | null;
  /** From the ID card QR; null when the applicant typed the number or skipped it. */
  idCard: { fullName: string; dateOfBirth: string; permanentAddress: string; issueDate: string; issuePlace: string } | null;
  phoneNumber: string | null;
  area: string | null;
  signedAt: Date;
  templateLabel: string;
  ip: string | null;
  device: string | null;
};

// Standard PDF fonts cannot draw Vietnamese diacritics; DejaVu Sans can.
const fontDir = join(dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const REGULAR = readFileSync(join(fontDir, 'DejaVuSans.ttf'));
const BOLD = readFileSync(join(fontDir, 'DejaVuSans-Bold.ttf'));
const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const INK = rgb(0.11, 0.17, 0.13);
const MUTED = rgb(0.4, 0.46, 0.42);

/**
 * The contract the technician signed: every page of the admin's template, then a
 * "Xác nhận ký kết" page with who signed, when, from where, and the signature itself.
 * Without a signature it is the preview the technician reads before signing: same pages, filled the same way.
 */
export async function buildSignedContractPdf(
  template: Uint8Array | null,
  signature: { bytes: Uint8Array; contentType: string } | null,
  info: SignedContractInfo,
): Promise<Uint8Array> {
  const pdf = template ? await PDFDocument.load(template, { ignoreEncryption: true }) : await PDFDocument.create();
  // The package is CommonJS; depending on interop the API sits on the module or on .default.
  pdf.registerFontkit((fontkitModule as any).default ?? fontkitModule);
  const regular = await pdf.embedFont(REGULAR, { subset: true });
  const bold = await pdf.embedFont(BOLD, { subset: true });
  const image = signature ? await embedSignature(pdf, signature.bytes) : null;
  fillTemplateFields(pdf, regular, info);

  const page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;
  const center = (text: string, font: PDFFont, size: number) => {
    page.drawText(text, { x: (A4[0] - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color: INK });
  };
  center('XÁC NHẬN KÝ KẾT HỢP ĐỒNG', bold, 16);
  y -= 22;
  center(`Số hợp đồng: ${info.contractNumber ?? 'cấp khi ký'}`, regular, 11);
  if (!image) {
    y -= 18;
    center('BẢN XEM TRƯỚC · CHƯA KÝ', bold, 10);
  }
  y -= 36;

  const signedAt = info.signedAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
  const rows: Array<[string, string | null]> = [
    ['Bên A (Kỹ thuật viên)', info.idCard?.fullName ?? info.displayName],
    ['Ngày sinh', info.idCard ? vnDate(info.idCard.dateOfBirth) : null],
    ['Số CCCD', info.idCardNumber],
    ['Ngày cấp · Nơi cấp', info.idCard ? `${vnDate(info.idCard.issueDate)} · ${info.idCard.issuePlace}` : null],
    ['Địa chỉ thường trú', info.idCard?.permanentAddress ?? null],
    ['Số điện thoại', info.phoneNumber],
    ['Khu vực', info.area],
    ['Thời điểm ký', image ? `${signedAt} (giờ Việt Nam)` : 'Chưa ký'],
    ['Mẫu hợp đồng', info.templateLabel],
    ['Địa chỉ IP', info.ip],
    ['Thiết bị', info.device],
  ];
  for (const [label, value] of rows) {
    page.drawText(`${label}:`, { x: MARGIN, y, size: 10.5, font: bold, color: MUTED });
    y = drawWrapped(page, value?.trim() || '—', MARGIN + 150, y, A4[0] - MARGIN * 2 - 150, regular, 10.5);
    y -= 19;
  }

  y -= 12;
  y = drawWrapped(
    page,
    'Bên A xác nhận đã đọc, hiểu và đồng ý toàn bộ điều khoản của Hợp đồng ở các trang trước, ' +
      'và ký điện tử bằng chữ ký dưới đây trên ứng dụng Psyocore.',
    MARGIN,
    y,
    A4[0] - MARGIN * 2,
    regular,
    10.5,
  );

  y -= 40;
  page.drawText('CHỮ KÝ CỦA BÊN A', { x: MARGIN, y, size: 11, font: bold, color: INK });
  const box = { width: 240, height: 120 };
  if (!image) {
    y -= 14 + box.height;
    page.drawRectangle({ x: MARGIN, y, ...box, borderColor: MUTED, borderWidth: 0.8, borderDashArray: [4, 3] });
    page.drawText('Bên A ký tay ở bước tiếp theo', { x: MARGIN + 40, y: y + box.height / 2 - 4, size: 10, font: regular, color: MUTED });
    pdf.setTitle('Hợp đồng (bản xem trước)');
    pdf.setProducer('Psyocore');
    return pdf.save();
  }
  const scale = Math.min(box.width / image.width, box.height / image.height, 1);
  const size = { width: image.width * scale, height: image.height * scale };
  y -= 14 + box.height;
  page.drawImage(image, { x: MARGIN, y: y + (box.height - size.height), ...size });
  page.drawText(info.idCard?.fullName ?? info.displayName ?? '', { x: MARGIN, y: y - 16, size: 10.5, font: regular, color: INK });

  pdf.setTitle(`Hợp đồng ${info.contractNumber ?? ''}`.trim());
  pdf.setProducer('Psyocore');
  return pdf.save();
}

/** Goes by the file's own header, not the declared type: pdf-lib only fails on bad bytes at save time. */
async function embedSignature(pdf: PDFDocument, bytes: Uint8Array) {
  const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isPng && !isJpeg) throw new Error('Chu ky phai la anh PNG hoac JPEG');
  return isPng ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}

/** YYYY-MM-DD -> dd/MM/yyyy */
const vnDate = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Fields the admin may place on the template (Acrobat > Prepare Form), filled from the application.
 * Unknown fields are left empty; the form is flattened so nothing can be edited after signing.
 */
export const TEMPLATE_FIELDS = {
  so_hop_dong: 'Số hợp đồng',
  ngay: 'Ngày ký (dd)',
  thang: 'Tháng ký (MM)',
  nam: 'Năm ký (yyyy)',
  ben_a_ho_ten: 'Họ tên Bên A',
  ben_a_ngay_sinh: 'Ngày sinh',
  ben_a_cccd: 'Số CCCD',
  ben_a_ngay_cap: 'Ngày cấp',
  ben_a_noi_cap: 'Nơi cấp',
  ben_a_dia_chi: 'Địa chỉ thường trú',
  ben_a_sdt: 'Số điện thoại',
} as const;

function fillTemplateFields(pdf: PDFDocument, font: PDFFont, info: SignedContractInfo) {
  const form = pdf.getForm();
  if (!form.getFields().length) return;
  const [nam, thang, ngay] = info.signedAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).split('-');
  const values: Record<keyof typeof TEMPLATE_FIELDS, string | null> = {
    so_hop_dong: info.contractNumber,
    ngay,
    thang,
    nam,
    ben_a_ho_ten: info.idCard?.fullName ?? info.displayName,
    ben_a_ngay_sinh: info.idCard ? vnDate(info.idCard.dateOfBirth) : null,
    ben_a_cccd: info.idCardNumber,
    ben_a_ngay_cap: info.idCard ? vnDate(info.idCard.issueDate) : null,
    ben_a_noi_cap: info.idCard?.issuePlace ?? null,
    ben_a_dia_chi: info.idCard?.permanentAddress ?? null,
    ben_a_sdt: info.phoneNumber?.replace(/^\+84/, '0') ?? null,
  };
  for (const field of form.getFields()) {
    const value = values[field.getName() as keyof typeof TEMPLATE_FIELDS];
    if (!(field instanceof PDFTextField)) continue;
    const text = value ?? '';
    field.setMaxLength(undefined);
    field.setText(text);
    // Shrink long values (an address) to fit the box instead of cutting them off.
    const width = Math.min(...field.acroField.getWidgets().map((widget) => widget.getRectangle().width)) - 4;
    if (text && width > 0) field.setFontSize(Math.max(6, Math.min(11, width / font.widthOfTextAtSize(text, 1))));
  }
  // Draw with DejaVu (the default Helvetica cannot render Vietnamese), then make the text part of the page.
  form.updateFieldAppearances(font);
  form.flatten({ updateFieldAppearances: false });
}

/** Draws text wrapped to `width`; returns the y below the last line. */
function drawWrapped(page: PDFPage, text: string, x: number, y: number, width: number, font: PDFFont, size: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.forEach((value, index) => page.drawText(value, { x, y: y - index * (size + 4), size, font, color: INK }));
  return y - (lines.length - 1) * (size + 4);
}
