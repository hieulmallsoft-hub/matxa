import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import * as fontkitModule from '@pdf-lib/fontkit';
import { PDFDocument } from 'pdf-lib';
import { buildSignedContractPdf } from './signed-contract-pdf';
import { readTemplateLines } from './contract-label-fill';

// The admin uploads an ordinary PDF (no form fields) with blanks like "Bên A: ......"; they get the ID card details.
describe('filling the dotted blanks of a plain contract template', () => {
  const template = async () => {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit((fontkitModule as any).default ?? fontkitModule);
    const dir = join(dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
    const font = await pdf.embedFont(readFileSync(join(dir, 'DejaVuSans.ttf')));
    const page = pdf.addPage([595, 842]);
    const dots = '.'.repeat(80);
    [
      'Số: .................... /HĐDV-PSYOCORE',
      'Hôm nay, ngày ...... tháng ...... năm 20..., chúng tôi gồm có:',
      `Bên A: ${dots}`,
      `CCCD số: ${dots}`,
      `Địa chỉ: ${dots}`,
      'Bên B: CÔNG TY PSYOCORE',
      `Địa chỉ: ${dots}`,
    ].forEach((text, index) => page.drawText(text, { x: 57, y: 700 - index * 20, size: 9.2, font }));
    return pdf.save();
  };

  it('writes Bên A details on the blanks and leaves Bên B alone', async () => {
    const bytes = await buildSignedContractPdf(await template(), null, {
      contractNumber: 'HD-2026-AB12CD34', displayName: 'KTV', idCardNumber: '042204007178',
      idCard: { fullName: 'Lê Chí Bảo', dateOfBirth: '2004-11-24', permanentAddress: 'Hương Sơn, Hà Tĩnh', issueDate: '2021-08-15', issuePlace: 'Bộ Công an' },
      phoneNumber: '+84336699857', area: null, signedAt: new Date('2026-11-06T03:00:00Z'), templateLabel: 't.pdf', ip: null, device: null,
    });
    const text = (await readTemplateLines(bytes, 1)).map((line) => line.text);
    expect(text).toEqual(expect.arrayContaining(['Lê Chí Bảo', '042204007178', 'Hương Sơn, Hà Tĩnh', '2026-AB12CD34', '06', '11', '2026']));
    // Bên B's address is still a blank, written once only.
    expect(text.filter((line) => line === 'Hương Sơn, Hà Tĩnh')).toHaveLength(1);
    expect(text.some((line) => line.startsWith('Địa chỉ: ....'))).toBe(true);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });
});
