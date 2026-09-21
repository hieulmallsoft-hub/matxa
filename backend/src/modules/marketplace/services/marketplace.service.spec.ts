import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';

describe('MarketplaceService', () => {
  const technicianProfile = { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() };
  const favorite = { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() };
  const prisma = { technicianProfile, favorite };
  const service = new MarketplaceService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('requires latitude and longitude together', async () => {
    await expect(service.searchTechnicians({ latitude: 21, page: 1, limit: 20 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sorts technicians by distance from the customer', async () => {
    technicianProfile.findMany.mockResolvedValue([
      { id: 'far', userId: 'u2', user: {}, tags: [], serviceModes: [], isVerified: true, isAvailable: true, averageRating: 5, reviewCount: 1, city: 'Ha Noi', services: [], latitude: 21.2, longitude: 105.8 },
      { id: 'near', userId: 'u1', user: {}, tags: [], serviceModes: [], isVerified: true, isAvailable: true, averageRating: 4, reviewCount: 1, city: 'Ha Noi', services: [], latitude: 21.01, longitude: 105.8 },
    ]);
    const result = await service.searchTechnicians({ latitude: 21, longitude: 105.8, page: 1, limit: 20 });
    expect(result.items.map((item) => item.id)).toEqual(['near', 'far']);
  });

  it('does not favorite a missing technician', async () => {
    technicianProfile.findUnique.mockResolvedValue(null);
    await expect(service.addFavorite('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
