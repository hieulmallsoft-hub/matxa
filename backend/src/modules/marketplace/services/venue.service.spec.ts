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
    await service.list({ category: 'TRAINING', city: 'HN' }, true);
    expect(prisma.venue.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { deletedAt: null, category: 'TRAINING', city: 'HN' } }),
    );
    await service.list({});
    expect(prisma.venue.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { deletedAt: null, isActive: true } }),
    );
    await service.remove('venue');
    expect(prisma.venue.update).toHaveBeenLastCalledWith({
      where: { id: 'venue' },
      data: { isActive: false, deletedAt: expect.any(Date) },
    });
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
