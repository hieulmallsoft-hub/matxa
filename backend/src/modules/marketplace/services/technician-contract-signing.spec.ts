import { BadRequestException, ConflictException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { TechnicianApplicationsService } from './technician-applications.service';
import { TechnicianContractService } from './technician-contract.service';

const SIGNATURE_PNG = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
);

// The applicant signs the contract by hand while applying; the signature is merged into the
// admin's template as one PDF that the admin reviews together with the application.
describe('signing the contract while applying', () => {
  const application = {
    id: 'application-1', userId: 'user-1', status: 'DRAFT', displayName: 'Duc Nguyen', idCardNumber: null,
    idCardFrontKey: 'f.jpg', idCardBackKey: 'b.jpg', faceImageKey: 'face.jpg', city: 'Hà Nội', district: 'Hoàn Kiếm',
    facility: null, address: null,
  };

  const subject = async (options: { templatePages?: number; signatureMissing?: boolean } = {}) => {
    const template = await PDFDocument.create();
    for (let page = 0; page < (options.templatePages ?? 2); page++) template.addPage();
    const files: Record<string, { bytes: Uint8Array; type: string }> = {
      'technician-contracts/templates/t.pdf': { bytes: await template.save(), type: 'application/pdf' },
      ...(options.signatureMissing ? {} : { 'technician-contracts/user-1/signatures/s.png': { bytes: SIGNATURE_PNG, type: 'image/png' } }),
    };
    const uploads: Record<string, Uint8Array> = {};
    const client = {
      send: jest.fn(async (command: any) => {
        const { Key, Body } = command.input;
        if (command.constructor.name === 'PutObjectCommand') {
          uploads[Key] = Body;
          return {};
        }
        const file = files[Key];
        if (!file) throw new Error('NoSuchKey');
        return { ContentType: file.type, Body: { transformToByteArray: async () => file.bytes } };
      }),
    };
    const prisma: any = {
      technicianApplication: {
        findUnique: jest.fn().mockResolvedValue(application),
        update: jest.fn(async ({ data }: any) => ({ ...application, ...data })),
      },
      technicianKyc: { upsert: jest.fn() },
      contractTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'template-1', storageKey: 'technician-contracts/templates/t.pdf', contentType: 'application/pdf',
          fileName: 'hop-dong-ktv.pdf', createdAt: new Date('2026-11-01T00:00:00Z'),
        }),
      },
      userIdentity: { findFirst: jest.fn().mockResolvedValue({ phoneNumber: '+84901234567' }) },
      technicianContract: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(async ({ create }: any) => create),
        updateMany: jest.fn(),
      },
    };
    const contracts = new TechnicianContractService(prisma, { get: () => undefined } as any);
    jest.spyOn(contracts as any, 'storage').mockReturnValue({ bucket: 'bucket', client });
    const applications = new TechnicianApplicationsService(prisma, {} as any, { notifyAdmins: jest.fn() } as any, contracts);
    return { applications, contracts, prisma, uploads };
  };
  const meta = { signatureKey: 'technician-contracts/user-1/signatures/s.png', ip: '1.2.3.4', userAgent: 'Psyocore/1.0', device: 'iPhone 16 Plus' };

  it('merges the signature into the template and records the consent when the application is submitted', async () => {
    const { applications, prisma, uploads } = await subject({ templatePages: 2 });
    await expect(applications.submit('user-1', meta)).resolves.toMatchObject({ status: 'SUBMITTED' });

    const [key] = Object.keys(uploads);
    expect(key).toMatch(/^technician-contracts\/user-1\/signed\/HD-\d{4}-[A-Z0-9]{8}\.pdf$/);
    expect((await PDFDocument.load(uploads[key])).getPageCount()).toBe(3);
    expect(prisma.technicianContract.upsert.mock.calls[0][0].create).toMatchObject({
      userId: 'user-1', applicationId: 'application-1', status: 'PENDING_REVIEW', templateVersion: 'template-1',
      signatureKey: meta.signatureKey, signedDocumentKey: key,
      contractData: { consent: { ip: '1.2.3.4', userAgent: 'Psyocore/1.0', device: 'iPhone 16 Plus', templateId: 'template-1' } },
    });
  });

  it('does not submit when the signature was never uploaded', async () => {
    const { applications, prisma } = await subject({ signatureMissing: true });
    await expect(applications.submit('user-1', meta)).rejects.toThrow(new BadRequestException('Chua tai anh chu ky len'));
    expect(prisma.technicianApplication.update).not.toHaveBeenCalled();
  });

  it("refuses a signature stored under someone else's folder", async () => {
    const { applications } = await subject();
    await expect(
      applications.submit('user-1', { ...meta, signatureKey: 'technician-contracts/user-2/signatures/s.png' }),
    ).rejects.toThrow(new BadRequestException('Chu ky khong hop le'));
  });

  it('only lets an applicant upload a signature while the application can still change', async () => {
    const { contracts, prisma } = await subject();
    prisma.technicianApplication.findUnique.mockResolvedValue({ status: 'SUBMITTED' });
    await expect(contracts.applicantSignatureUploadUrl('user-1', 'image/png', 1000)).rejects.toBeInstanceOf(ConflictException);
  });

  it('makes the contract effective when the application is approved', async () => {
    const { contracts, prisma } = await subject();
    await contracts.reviewWithApplication('application-1', 'admin-1', 'APPROVED');
    expect(prisma.technicianContract.updateMany).toHaveBeenCalledWith({
      where: { applicationId: 'application-1', status: 'PENDING_REVIEW' },
      data: expect.objectContaining({ status: 'APPROVED', reviewedBy: 'admin-1', rejectionReason: null }),
    });
  });
});
