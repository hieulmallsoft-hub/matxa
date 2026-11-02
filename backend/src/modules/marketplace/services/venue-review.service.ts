import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpsertVenueReviewDto, VenueReviewQueryDto } from '../dto/venue.dto';

const reviewer = { select: { id: true, displayName: true, avatarUrl: true } };

/** Public names keep only the last character, like the app design ("••••••••••g"). */
const maskName = (name?: string | null) => {
  const trimmed = name?.trim();
  return trimmed ? `••••••••••${trimmed.slice(-1)}` : 'Khách hàng';
};

@Injectable()
export class VenueReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async list(venueId: string, query: VenueReviewQueryDto, admin = false) {
    await this.requireVenue(venueId, !admin);
    const where = { venueId, ...(admin ? {} : { isHidden: false }), ...(query.rating ? { rating: query.rating } : {}) };
    const [items, total, summary] = await Promise.all([
      this.prisma.venueReview.findMany({
        where,
        include: { user: reviewer },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.venueReview.count({ where }),
      this.summary(venueId),
    ]);
    return { items: items.map((review) => this.response(review, admin)), total, page: query.page, limit: query.limit, summary };
  }

  /** Average, count and 1–5 star distribution over visible reviews. */
  async summary(venueId: string) {
    const groups = await this.prisma.venueReview.groupBy({
      by: ['rating'],
      where: { venueId, isHidden: false },
      _count: { _all: true },
    });
    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let count = 0;
    let total = 0;
    for (const group of groups) {
      distribution[group.rating as 1 | 2 | 3 | 4 | 5] = group._count._all;
      count += group._count._all;
      total += group.rating * group._count._all;
    }
    return { average: count ? Math.round((total / count) * 10) / 10 : 0, count, distribution };
  }

  async latest(venueId: string, take = 3) {
    const reviews = await this.prisma.venueReview.findMany({
      where: { venueId, isHidden: false },
      include: { user: reviewer },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return reviews.map((review) => this.response(review));
  }

  async mine(userId: string, venueId: string) {
    const review = await this.prisma.venueReview.findUnique({
      where: { venueId_userId: { venueId, userId } },
      include: { user: reviewer },
    });
    return review ? this.response(review) : null;
  }

  /** One review per customer per venue; writing again replaces it. */
  async upsert(userId: string, venueId: string, dto: UpsertVenueReviewDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
    if (user?.role !== 'CUSTOMER' || user.status !== 'ACTIVE')
      throw new ForbiddenException('Chỉ khách hàng mới được đánh giá địa điểm');
    await this.requireVenue(venueId, true);
    const comment = dto.comment || null;
    const review = await this.prisma.venueReview.upsert({
      where: { venueId_userId: { venueId, userId } },
      create: { venueId, userId, rating: dto.rating, comment },
      update: { rating: dto.rating, comment },
      include: { user: reviewer },
    });
    await this.refreshVenueRating(venueId);
    return this.response(review);
  }

  async moderate(reviewId: string, isHidden: boolean) {
    const current = await this.prisma.venueReview.findUnique({ where: { id: reviewId }, select: { venueId: true } });
    if (!current) throw new NotFoundException('Không tìm thấy đánh giá');
    const review = await this.prisma.venueReview.update({
      where: { id: reviewId },
      data: { isHidden },
      include: { user: reviewer },
    });
    await this.refreshVenueRating(current.venueId);
    return this.response(review, true);
  }

  /** Keeps Venue.rating/reviewCount in step so list sorting and minRating filters stay in SQL. */
  private async refreshVenueRating(venueId: string) {
    const aggregate = await this.prisma.venueReview.aggregate({
      where: { venueId, isHidden: false },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.venue.update({
      where: { id: venueId },
      data: { rating: Math.round((aggregate._avg.rating ?? 0) * 100) / 100, reviewCount: aggregate._count._all },
    });
  }

  private async requireVenue(venueId: string, publicOnly: boolean) {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, deletedAt: null, ...(publicOnly ? { isActive: true } : {}) },
      select: { id: true },
    });
    if (!venue) throw new NotFoundException('Không tìm thấy địa điểm');
  }

  private response(review: any, admin = false) {
    return {
      id: review.id,
      venueId: review.venueId,
      rating: review.rating,
      comment: review.comment ?? null,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      reviewer: {
        displayName: admin ? (review.user?.displayName ?? null) : maskName(review.user?.displayName),
        avatarUrl: review.user?.avatarUrl ?? null,
      },
      ...(admin ? { userId: review.userId, isHidden: review.isHidden } : {}),
    };
  }
}
