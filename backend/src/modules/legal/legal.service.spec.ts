import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LegalService } from './legal.service';

// "Điều khoản và chính sách": the admin uploads each document as a PDF; every upload is a new version.
describe('LegalService', () => {
  const row = (code: string, version: number, extra: object = {}) => ({
    id: `${code}-${version}`, code, title: code, audience: 'ALL', version, storageKey: `legal-documents/${code}/v${version}.pdf`,
    fileName: `${code}.pdf`, sortOrder: 0, isActive: true, createdBy: null, createdAt: new Date(`2026-11-0${version}T00:00:00Z`), ...extra,
  });

  const subject = (rows: any[] = []) => {
    const puts: string[] = [];
    const prisma: any = {
      legalDocument: {
        findMany: jest.fn(async ({ where }: any = {}) =>
          rows.filter((r) => (where?.isActive === undefined || r.isActive === where.isActive)
            && (!where?.audience || where.audience.in.includes(r.audience)))),
        findFirst: jest.fn(async ({ where }: any) =>
          rows.filter((r) => r.code === where.code && (where.isActive === undefined || r.isActive === where.isActive))
            .sort((a, b) => b.version - a.version)[0] ?? null),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const hit = rows.filter((r) => r.code === where.code);
          hit.forEach((r) => Object.assign(r, data));
          return { count: hit.length };
        }),
        create: jest.fn(async ({ data }: any) => {
          const created = { id: 'new', createdAt: new Date(), isActive: true, ...data };
          rows.push(created);
          return created;
        }),
      },
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    const service = new LegalService(prisma, { get: () => undefined } as any);
    jest.spyOn(service as any, 'storage').mockReturnValue({
      bucket: 'bucket',
      client: { send: jest.fn(async (command: any) => puts.push(command.input.Key)) },
    });
    jest.spyOn(service as any, 'downloadUrl').mockImplementation(async (key: any) => `https://signed/${key}`);
    return { service, prisma, rows, puts };
  };
  const pdf = (name = 'chinh-sach.pdf') => ({ originalname: name, mimetype: 'application/pdf', size: 1000, buffer: Buffer.from('%PDF-1.7') });

  it('lists the newest version of each document for an audience, documents for everyone included', async () => {
    const { service } = subject([
      row('PRIVACY_POLICY', 1, { isActive: false }), row('PRIVACY_POLICY', 2),
      row('TECHNICIAN_TERMS', 1, { audience: 'TECHNICIAN' }), row('CUSTOMER_ONLY', 1, { audience: 'CUSTOMER' }),
    ]);
    const list = await service.list('TECHNICIAN');
    expect(list.map((item) => [item.code, item.versionLabel])).toEqual([['PRIVACY_POLICY', '2.0'], ['TECHNICIAN_TERMS', '1.0']]);
  });

  it('gives the app a short-lived link to the current PDF', async () => {
    const { service } = subject([row('TERMS_OF_USE', 1, { isActive: false }), row('TERMS_OF_USE', 2)]);
    await expect(service.get('TERMS_OF_USE')).resolves.toMatchObject({
      version: 2, versionLabel: '2.0', downloadUrl: 'https://signed/legal-documents/TERMS_OF_USE/v2.pdf', expiresIn: 600,
    });
    await expect(service.get('NOPE')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('turns a new upload of the same document into the next version and keeps the old one as history', async () => {
    const { service, rows, puts } = subject([row('PRIVACY_POLICY', 1)]);
    const created = await service.upload('admin-1', pdf(), { code: 'PRIVACY_POLICY', title: 'Chính sách bảo mật', audience: 'ALL' });
    expect(created).toMatchObject({ code: 'PRIVACY_POLICY', version: 2, isActive: true, createdBy: 'admin-1' });
    expect(rows.find((r) => r.version === 1)!.isActive).toBe(false);
    expect(puts[0]).toMatch(/^legal-documents\/PRIVACY_POLICY\/v2-[0-9a-f-]+\.pdf$/);
  });

  it('derives a code from the Vietnamese title when none is given', async () => {
    const { service } = subject();
    const created = await service.upload('admin-1', pdf(), { title: 'Điều khoản dịch vụ đối với kỹ thuật viên', audience: 'TECHNICIAN' });
    expect(created).toMatchObject({ code: 'DIEU_KHOAN_DICH_VU_DOI_VOI_KY_THUAT_VIEN', version: 1, audience: 'TECHNICIAN' });
  });

  it.each([
    [{ ...pdf(), mimetype: 'image/png' }, { title: 'A', audience: 'ALL' }],
    [pdf(), { title: '  ', audience: 'ALL' }],
    [pdf(), { title: 'A', audience: 'EVERYONE' }],
  ])('refuses an upload that is not a titled PDF for a known audience', async (file, dto) => {
    const { service } = subject();
    await expect(service.upload('admin-1', file as any, dto as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
