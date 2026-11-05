import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import * as fontkitModule from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';

export type SignedContractInfo = {
  contractNumber: string;
  displayName: string | null;
  idCardNumber: string | null;
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
 */
export async function buildSignedContractPdf(
  template: Uint8Array | null,
  signature: { bytes: Uint8Array; contentType: string },
  info: SignedContractInfo,
): Promise<Uint8Array> {
  const pdf = template ? await PDFDocument.load(template, { ignoreEncryption: true }) : await PDFDocument.create();
  // The package is CommonJS; depending on interop the API sits on the module or on .default.
  pdf.registerFontkit((fontkitModule as any).default ?? fontkitModule);
  const regular = await pdf.embedFont(REGULAR, { subset: true });
  const bold = await pdf.embedFont(BOLD, { subset: true });
  // Go by the file's own header, not the declared type: pdf-lib only fails on bad bytes at save time.
  const bytes = signature.bytes;
  const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isPng && !isJpeg) throw new Error('Chu ky phai la anh PNG hoac JPEG');
  const image = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);

  const page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;
  const center = (text: string, font: PDFFont, size: number) => {
    page.drawText(text, { x: (A4[0] - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color: INK });
  };
  center('XÁC NHẬN KÝ KẾT HỢP ĐỒNG', bold, 16);
  y -= 22;
  center(`Số hợp đồng: ${info.contractNumber}`, regular, 11);
  y -= 36;

  const signedAt = info.signedAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
  const rows: Array<[string, string | null]> = [
    ['Bên A (Kỹ thuật viên)', info.displayName],
    ['Số CCCD', info.idCardNumber],
    ['Số điện thoại', info.phoneNumber],
    ['Khu vực', info.area],
    ['Thời điểm ký', `${signedAt} (giờ Việt Nam)`],
    ['Mẫu hợp đồng', info.templateLabel],
    ['Địa chỉ IP', info.ip],
    ['Thiết bị', info.device],
  ];
  for (const [label, value] of rows) {
    page.drawText(`${label}:`, { x: MARGIN, y, size: 10.5, font: bold, color: MUTED });
    y = drawWrapped(page, value?.trim() || '—', MARGIN + 150, y, A4[0] - MARGIN * 2 - 150, regular, 10.5);
    y -= 10;
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
  const scale = Math.min(box.width / image.width, box.height / image.height, 1);
  const size = { width: image.width * scale, height: image.height * scale };
  y -= 14 + box.height;
  page.drawImage(image, { x: MARGIN, y: y + (box.height - size.height), ...size });
  page.drawText(info.displayName ?? '', { x: MARGIN, y: y - 16, size: 10.5, font: regular, color: INK });

  pdf.setTitle(`Hợp đồng ${info.contractNumber}`);
  pdf.setProducer('Psyocore');
  return pdf.save();
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
