import { ConflictException } from '@nestjs/common';
import { parseModes } from './settings.service';
import { BookingsService } from '../bookings/services/bookings.service';
import { TechnicianApplicationsService } from '../marketplace/services/technician-applications.service';

describe('admin switches "noi phuc vu" on and off', () => {
  it('reads the stored list, and treats never-set or garbage as every mode on', () => {
    expect(parseModes('HOME,ONLINE')).toEqual(['HOME', 'ONLINE']);
    expect(parseModes(' ONSITE ')).toEqual(['ONSITE']);
    expect(parseModes(undefined)).toEqual(['HOME', 'ONLINE', 'ONSITE']);
    expect(parseModes('nope')).toEqual(['HOME', 'ONLINE', 'ONSITE']);
  });

  it('refuses a booking for a switched-off mode', async () => {
    const settings = { getBookingRules: jest.fn().mockResolvedValue({ enabledServiceModes: ['HOME', 'ONLINE'] }) };
    const service = new BookingsService({} as any, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any,
      undefined, undefined, undefined, settings as any);
    jest.spyOn(service as any, 'assertCustomer').mockResolvedValue(undefined);
    const attempt = service.matchingTechnicians('customer-1', { mode: 'ONSITE' });
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(service.matchingTechnicians('customer-1', { mode: 'ONSITE' })).rejects.toMatchObject({
      response: { code: 'SERVICE_MODE_DISABLED' },
    });
  });

  describe('technician application', () => {
    const subject = (currentModes: string[]) => {
      const prisma: any = {
        systemSetting: { findUnique: jest.fn().mockResolvedValue({ value: 'HOME,ONLINE' }) },
        technicianApplication: {
          upsert: jest.fn().mockResolvedValue({ status: 'DRAFT', supportedModes: currentModes, city: null, district: null }),
          update: jest.fn(async ({ data }: any) => data),
        },
        city: { findMany: jest.fn().mockResolvedValue([]) },
        district: { findMany: jest.fn().mockResolvedValue([]) },
      };
      return { prisma, service: new TechnicianApplicationsService(prisma, {} as any, {} as any) };
    };

    it('cannot newly pick a switched-off mode', async () => {
      const { service, prisma } = subject(['HOME']);
      await expect(service.updateMine('user-1', { supportedModes: ['HOME', 'ONSITE'] } as any)).rejects.toMatchObject({
        response: { code: 'SERVICE_MODE_DISABLED', modes: ['ONSITE'] },
      });
      expect(prisma.technicianApplication.update).not.toHaveBeenCalled();
    });

    it('keeps a switched-off mode the technician already had', async () => {
      const { service, prisma } = subject(['ONSITE']);
      prisma.technicianApplication.upsert.mockResolvedValue({
        status: 'DRAFT', supportedModes: ['ONSITE'], facility: 'Spa', address: '12 Ly Thuong Kiet', city: null, district: null,
      });
      await expect(service.updateMine('user-1', { supportedModes: ['ONSITE', 'HOME'] } as any)).resolves.toBeDefined();
    });
  });
});
