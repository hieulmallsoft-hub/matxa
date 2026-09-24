import { BadRequestException } from '@nestjs/common';
import { loadBookableServices, publicTechnicianWhere } from './technician-selection';

describe('Technician publication policy', () => {
  it('requires verification, an active profile/account and an active categorized service', () => {
    expect(publicTechnicianWhere).toEqual({ isActive: true, isVerified: true,
      user: { status: 'ACTIVE' }, services: { some: { isActive: true, category: { isActive: true } } } });
  });

  it('rechecks verification in the service query used by both quote and create', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await expect(loadBookableServices({ technicianService: { findMany } } as never, 'profile-id', ['service-id'], 'HOME'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).toHaveBeenCalledWith({ where: {
      id: { in: ['service-id'] }, technicianId: 'profile-id', isActive: true, category: { isActive: true },
      technician: { isActive: true, isVerified: true, user: { status: 'ACTIVE' }, serviceModes: { has: 'HOME' } },
    } });
  });
});
