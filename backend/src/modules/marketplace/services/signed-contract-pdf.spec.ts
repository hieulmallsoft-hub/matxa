import { PDFDocument, StandardFonts } from 'pdf-lib';
import { buildSignedContractPdf } from './signed-contract-pdf';

// 1x1 transparent PNG, standing in for the technician's hand-drawn signature.
const SIGNATURE_PNG = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
);

describe('signed contract PDF', () => {
  const info = {
    contractNumber: 'HD-2026-AB12CD34',
    displayName: 'Nguyễn Văn Đức',
    idCardNumber: null,
    idCard: null,
    phoneNumber: '+84901234567',
    area: 'Hoàn Kiếm, Hà Nội',
    signedAt: new Date('2026-11-05T02:30:00Z'),
    templateLabel: 'hop-dong-ktv.pdf',
    ip: '1.2.3.4',
    device: 'iPhone 16 Plus',
  };

  it('keeps every page of the template and appends the signature page', async () => {
    const template = await PDFDocument.create();
    template.addPage();
    template.addPage();
    const bytes = await buildSignedContractPdf(await template.save(), { bytes: SIGNATURE_PNG, contentType: 'image/png' }, info);
    const signed = await PDFDocument.load(bytes);
    expect(signed.getPageCount()).toBe(3);
    expect(signed.getTitle()).toBe('Hợp đồng HD-2026-AB12CD34');
  });

  it('still produces the signature page when no template was uploaded', async () => {
    const bytes = await buildSignedContractPdf(null, { bytes: SIGNATURE_PNG, contentType: 'image/png' }, info);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it('rejects a signature that is not an image', async () => {
    await expect(
      buildSignedContractPdf(null, { bytes: Uint8Array.from([1, 2, 3]), contentType: 'image/png' }, info),
    ).rejects.toThrow();
  });

  it('fills the Ben A fields of the template from the ID card, in Vietnamese, and locks them', async () => {
    const template = await PDFDocument.create();
    const page = template.addPage();
    const form = template.getForm();
    for (const [index, name] of ['so_hop_dong', 'ngay', 'ben_a_ho_ten', 'ben_a_cccd', 'ben_a_noi_cap', 'ben_a_dia_chi', 'ghi_chu'].entries())
      form.createTextField(name).addToPage(page, { x: 50, y: 700 - index * 40, width: 400, height: 20 });
    form.updateFieldAppearances(await template.embedFont(StandardFonts.Helvetica));
    const bytes = await buildSignedContractPdf(await template.save(), { bytes: SIGNATURE_PNG, contentType: 'image/png' }, {
      ...info,
      idCardNumber: '001099012345',
      idCard: {
        fullName: 'Nguyễn Thị Hồng Nhung',
        dateOfBirth: '1999-01-01',
        permanentAddress: 'Thôn Giền, Ngọc Thiện, Bắc Ninh',
        issueDate: '2026-02-25',
        issuePlace: 'Bộ Công an',
      },
    });
    const signed = await PDFDocument.load(bytes);
    expect(signed.getForm().getFields()).toHaveLength(0);
    expect(signed.getPageCount()).toBe(2);
  });
});
