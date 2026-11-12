import { NotFoundException } from '@nestjs/common';
import { AdminMarketplaceService } from './admin-marketplace.service';

// Admin edits a technician's package price: the service's starting price shown in lists must follow it.
describe('admin edits a technician package price', () => {
  const setup = (count = 1) => {
    const tx = {
      technicianServicePriceOption: {
        updateMany: jest.fn().mockResolvedValue({ count }),
        findFirst: jest.fn().mockResolvedValue({ durationMinutes: 60, price: 500000 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'option-60', durationMinutes: 60, price: 500000 }),
      },
      technicianService: { update: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((run: any) => run(tx)) };
    return { tx, service: new AdminMarketplaceService(prisma as any) };
  };

  it('updates the starting price of the service too', async () => {
    const { tx, service } = setup();
    const result = await service.updateTechnicianPriceOption('tech-1', 'service-1', 'option-60', { price: 500000 });
    expect(tx.technicianServicePriceOption.updateMany).toHaveBeenCalledWith({
      where: { id: 'option-60', technicianServiceId: 'service-1', technicianService: { technicianId: 'tech-1' } },
      data: { price: 500000 },
    });
    expect(tx.technicianService.update).toHaveBeenCalledWith({
      where: { id: 'service-1' },
      data: { durationMinutes: 60, price: 500000 },
    });
    expect(result).toMatchObject({ id: 'option-60', price: 500000 });
  });

  it('changes nothing when the package is not that technician\'s', async () => {
    const { tx, service } = setup(0);
    await expect(service.updateTechnicianPriceOption('tech-1', 'service-1', 'other', { price: 500000 }))
      .rejects.toThrow(NotFoundException);
    expect(tx.technicianService.update).not.toHaveBeenCalled();
  });
});
