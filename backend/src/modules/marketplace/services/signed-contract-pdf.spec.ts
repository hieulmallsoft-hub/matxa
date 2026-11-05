import { PDFDocument } from 'pdf-lib';
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
});
