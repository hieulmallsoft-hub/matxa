import { BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { CreateVenueDto, UpdateVenueDto } from '../dto/venue.dto';
import { VenueService } from './venue.service';

describe('venue management', () => {
  const venue = {
    id: 'venue',
    name: 'Spa',
    category: 'MASSAGE_SPA',
    address: 'Address',
    city: 'HN',
    latitude: '21.1',
    longitude: '105.1',
    rating: '4.5',
    reviewCount: 1,
    services: [{ name: 'Massage', price: '100000', durationMinutes: 60 }],
    hours: [],
    images: [],
    isActive: true,
  };
  const dto: CreateVenueDto = {
    name: 'Spa',
    address: 'Address',
    city: 'HN',
    latitude: 21.1,
    longitude: 105.1,
    category: 'MASSAGE_SPA',
  };
  function setup() {
    const prisma: any = {
      venue: {
        findMany: jest.fn().mockResolvedValue([venue]),
        findFirst: jest.fn().mockResolvedValue(venue),
        create: jest.fn().mockResolvedValue(venue),
        update: jest.fn().mockResolvedValue(venue),
      },
    };
    return { prisma, service: new VenueService(prisma) };
  }
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const validate = (body: unknown, metatype: new () => object = CreateVenueDto) =>
    pipe.transform(body, { type: 'body', metatype });

  it('creates the supplied category, services, images and opening hours', async () => {
    const { service, prisma } = setup();
    const services = [{ name: 'Massage', durationMinutes: 90, price: 250000 }];
    const hours = [{ dayOfWeek: 1, openTime: '10:00', closeTime: '20:00' }];
    const result = await service.create({
      ...dto,
      category: 'CONSULTATION',
      services,
      hours,
      images: ['https://example.com/spa.jpg'],
    });
    expect(prisma.venue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'CONSULTATION',
          images: ['https://example.com/spa.jpg'],
          services: { create: services },
          hours: { create: hours },
        }),
      }),
    );
    expect(result).toMatchObject({ rating: 4.5, latitude: 21.1, services: [{ price: 100000 }] });
  });

  it('atomically replaces services and hours when editing, including empty lists', async () => {
    const { service, prisma } = setup();
    const hours = [{ dayOfWeek: 0, isClosed: true }];
    await service.update('venue', { services: [], hours });
    expect(prisma.venue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          services: { deleteMany: {}, create: [] },
          hours: { deleteMany: {}, create: [{ ...hours[0], openTime: null, closeTime: null }] },
        },
      }),
    );
  });

  it('accepts a publish-only PATCH without wiping existing services or hours', async () => {
    const { service, prisma } = setup();
    const patch = await validate({ isActive: false }, UpdateVenueDto);
    await service.update('venue', patch);
    expect(prisma.venue.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false } }));
  });

  it('keeps deleted venues out of admin lists and inactive venues out of public lists', async () => {
    const { service, prisma } = setup();
    await service.list({ category: 'CONSULTATION', city: 'HN' }, true);
    expect(prisma.venue.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { deletedAt: null, category: 'CONSULTATION', city: 'HN' } }),
    );
    await service.list({});
    expect(prisma.venue.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, isActive: true, category: { in: ['MASSAGE_SPA', 'CONSULTATION'] } },
      }),
    );
    await service.remove('venue');
    expect(prisma.venue.update).toHaveBeenLastCalledWith({
      where: { id: 'venue' },
      data: { isActive: false, deletedAt: expect.any(Date) },
    });
  });

  it('adds distance from the user and can sort by it', async () => {
    const { service, prisma } = setup();
    const far = { ...venue, id: 'far', latitude: '21.2', longitude: '105.1', rating: '5' };
    prisma.venue.findMany.mockResolvedValue([far, venue]);
    const items = await service.list({ latitude: 21.1, longitude: 105.1, sort: 'distance' });
    expect(items.map((item) => item.id)).toEqual(['venue', 'far']);
    expect(items[0].distanceKm).toBe(0);
    expect(items[1].distanceKm).toBeCloseTo(11.1, 1);
    expect((await service.list({}))[0].distanceKm).toBeNull();
  });

  it('filters by minimum rating in the query', async () => {
    const { service, prisma } = setup();
    await service.list({ minRating: 4 });
    expect(prisma.venue.findMany.mock.calls[0][0].where.rating).toEqual({ gte: 4 });
  });

  it('shows only a running, active promotion as the venue offer', async () => {
    const { service, prisma } = setup();
    const promotion = {
      id: 'p', code: 'SPA40', name: 'Giảm 40% dịch vụ massage', type: 'PERCENT', value: '40', minOrderAmount: '0',
      maxDiscount: null, isActive: true, startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 86_400_000),
      description: 'Thông tin', terms: 'Điều khoản', note: 'Lưu ý',
    };
    prisma.venue.findFirst.mockResolvedValue({ ...venue, promotionId: 'p', promotion });
    const detail: any = await service.detail('venue');
    expect(detail.offer).toMatchObject({ code: 'SPA40', discountLabel: '-40%', terms: 'Điều khoản', note: 'Lưu ý' });
    expect(detail).not.toHaveProperty('promotion');
    prisma.venue.findFirst.mockResolvedValue({ ...venue, promotion: { ...promotion, endsAt: new Date(Date.now() - 1) } });
    expect(((await service.detail('venue')) as any).offer).toBeNull();
  });

  it('rejects an unknown promotion and allows clearing it with null', async () => {
    const { service, prisma } = setup();
    prisma.promotion = { findUnique: jest.fn().mockResolvedValue(null) };
    await expect(service.update('venue', { promotionId: '6b2ff86e-1e4c-4e0b-8b69-33b288a50efe' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await service.update('venue', { promotionId: null });
    expect(prisma.venue.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { promotionId: null } }));
  });

  it('no longer accepts the training category', async () => {
    await expect(validate({ ...dto, category: 'TRAINING' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not edit or delete an unavailable venue', async () => {
    const { service, prisma } = setup();
    prisma.venue.findFirst.mockResolvedValue(null);
    await expect(service.update('missing', { name: 'Updated' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    [
      { dayOfWeek: 1, openTime: '10:00', closeTime: '20:00' },
      { dayOfWeek: 1, isClosed: true },
    ],
    [{ dayOfWeek: 1, openTime: '20:00', closeTime: '10:00' }],
  ])('rejects duplicate days and invalid time ranges (%j)', async (...hours) => {
    const { service } = setup();
    // Jest expands each row; both cases represent invalid opening schedules.
    const rows = hours.filter((hour) => typeof hour === 'object') as any;
    await expect(service.create({ ...dto, hours: rows })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    { images: ['data:image/png;base64,AAAA'] },
    { name: '   ' },
    { latitude: 91 },
    { services: [{ name: 'Massage', durationMinutes: 60, price: -1 }] },
    { hours: [{ dayOfWeek: 7, openTime: '09:00', closeTime: '22:00' }] },
    { hours: [{ dayOfWeek: 1, openTime: '99:00', closeTime: '22:00' }] },
  ])('validates nested form data and rejects invalid payload %j', async (invalid) => {
    await expect(validate({ ...dto, ...invalid })).rejects.toBeInstanceOf(BadRequestException);
  });
});
