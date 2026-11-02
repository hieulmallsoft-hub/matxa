import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VenueReviewService } from './venue-review.service';

describe('VenueReviewService', () => {
  const review = {
    id: 'r1', venueId: 'venue', userId: 'customer', rating: 5, comment: 'Rất tốt', isHidden: false,
    createdAt: new Date('2026-11-01'), updatedAt: new Date('2026-11-01'),
    user: { id: 'customer', displayName: 'Nguyen Long', avatarUrl: 'https://cdn/a.jpg' },
  };
  function setup(role = 'CUSTOMER') {
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ role, status: 'ACTIVE' }) },
      venue: { findFirst: jest.fn().mockResolvedValue({ id: 'venue' }), update: jest.fn() },
      venueReview: {
        upsert: jest.fn().mockResolvedValue(review),
        update: jest.fn().mockResolvedValue({ ...review, isHidden: true }),
        findUnique: jest.fn().mockResolvedValue({ venueId: 'venue' }),
        findMany: jest.fn().mockResolvedValue([review]),
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.666 }, _count: { _all: 3 } }),
        groupBy: jest.fn().mockResolvedValue([
          { rating: 5, _count: { _all: 2 } },
          { rating: 4, _count: { _all: 1 } },
        ]),
      },
    };
    return { prisma, service: new VenueReviewService(prisma) };
  }

  it('lets a customer write one review per venue and refreshes the cached rating', async () => {
    const { service, prisma } = setup();
    const saved = await service.upsert('customer', 'venue', { rating: 5, comment: 'Rất tốt' });
    expect(prisma.venueReview.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { venueId_userId: { venueId: 'venue', userId: 'customer' } },
      update: { rating: 5, comment: 'Rất tốt' },
    }));
    expect(prisma.venue.update).toHaveBeenCalledWith({ where: { id: 'venue' }, data: { rating: 4.67, reviewCount: 3 } });
    expect(saved.reviewer).toEqual({ displayName: '••••••••••g', avatarUrl: 'https://cdn/a.jpg' });
    expect(saved).not.toHaveProperty('userId');
  });

  it('rejects technicians and hidden or missing venues', async () => {
    await expect(setup('TECHNICIAN').service.upsert('tech', 'venue', { rating: 5 })).rejects.toBeInstanceOf(ForbiddenException);
    const { service, prisma } = setup();
    prisma.venue.findFirst.mockResolvedValue(null);
    await expect(service.upsert('customer', 'venue', { rating: 5 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('summarises visible reviews into average and 1–5 distribution', async () => {
    const { service, prisma } = setup();
    await expect(service.summary('venue')).resolves.toEqual({
      average: 4.7, count: 3, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 },
    });
    expect(prisma.venueReview.groupBy.mock.calls[0][0].where).toEqual({ venueId: 'venue', isHidden: false });
  });

  it('hides moderated reviews from the public list but shows them with real names to admins', async () => {
    const { service, prisma } = setup();
    await service.list('venue', { page: 1, limit: 20, rating: 5 });
    expect(prisma.venueReview.findMany.mock.calls[0][0].where).toEqual({ venueId: 'venue', isHidden: false, rating: 5 });
    const admin = await service.list('venue', { page: 1, limit: 20 }, true);
    expect(prisma.venueReview.findMany.mock.calls[1][0].where).toEqual({ venueId: 'venue' });
    expect(admin.items[0]).toMatchObject({ userId: 'customer', isHidden: false, reviewer: { displayName: 'Nguyen Long' } });
  });

  it('recomputes the venue rating after hiding a review', async () => {
    const { service, prisma } = setup();
    await service.moderate('r1', true);
    expect(prisma.venueReview.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isHidden: true } }));
    expect(prisma.venue.update).toHaveBeenCalled();
    prisma.venueReview.findUnique.mockResolvedValue(null);
    await expect(service.moderate('missing', true)).rejects.toBeInstanceOf(NotFoundException);
  });
});
