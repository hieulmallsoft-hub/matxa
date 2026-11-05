import { ConflictException, NotFoundException } from '@nestjs/common';
import { ServiceCatalogService } from './service-catalog.service';

describe('deleting a catalog service', () => {
  const subject = (booked: number) => {
    const prisma: any = {
      serviceCatalogItem: { findUnique: jest.fn().mockResolvedValue({ id: 'svc-1' }), delete: jest.fn().mockReturnValue('delete-item') },
      bookingItem: { count: jest.fn().mockResolvedValue(booked) },
      technicianService: { deleteMany: jest.fn().mockReturnValue('delete-offers') },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    return { prisma, service: new ServiceCatalogService(prisma) };
  };

  it('deletes a service nobody booked, with the technicians offers of it', async () => {
    const { prisma, service } = subject(0);
    await service.remove('svc-1');
    expect(prisma.technicianService.deleteMany).toHaveBeenCalledWith({ where: { catalogServiceId: 'svc-1' } });
    expect(prisma.serviceCatalogItem.delete).toHaveBeenCalledWith({ where: { id: 'svc-1' } });
    expect(prisma.$transaction).toHaveBeenCalledWith(['delete-offers', 'delete-item']);
  });

  it('keeps a booked service and tells the admin to hide it', async () => {
    const { prisma, service } = subject(3);
    await expect(service.remove('svc-1')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.remove('svc-1')).rejects.toThrow('3 don dat lich');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('answers not found for an unknown service', async () => {
    const { prisma, service } = subject(0);
    prisma.serviceCatalogItem.findUnique.mockResolvedValue(null);
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
