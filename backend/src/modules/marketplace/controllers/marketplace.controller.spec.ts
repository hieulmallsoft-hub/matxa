import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../database/prisma.service';
import { OptionalAccessTokenGuard } from '../../auth/guards/optional-access-token.guard';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from '../services/marketplace.service';

describe('Marketplace HTTP validation and optional authentication', () => {
  let app: INestApplication;
  let base: string;
  const jwt = new JwtService({ secret: 'marketplace-tests-only' });
  const session = { findFirst: jest.fn() };
  const service = { searchTechnicians: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    technicianDetail: jest.fn().mockResolvedValue({ technicianId: '11111111-1111-4111-8111-111111111111', isFavorite: false }),
    home: jest.fn().mockResolvedValue({ banners: [], categories: [], technicians: [] }) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [MarketplaceController], providers: [
      OptionalAccessTokenGuard, { provide: JwtService, useValue: jwt },
      { provide: PrismaService, useValue: { session } }, { provide: MarketplaceService, useValue: service },
    ] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/api/marketplace`;
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => { jest.clearAllMocks(); session.findFirst.mockResolvedValue({ id: 'session' }); });

  it('allows guests and preserves false while parsing pagination and tags', async () => {
    const response = await fetch(`${base}/technicians?available=false&tags=massage,yoga&page=2&limit=5`);
    expect(response.status).toBe(200);
    expect(service.searchTechnicians).toHaveBeenCalledWith(expect.objectContaining({ available: false, tags: ['massage', 'yoga'], page: 2, limit: 5 }), undefined);
    expect(session.findFirst).not.toHaveBeenCalled();
  });
  it('allows guest detail and forwards a validated viewer for authenticated detail', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect((await fetch(`${base}/technicians/${id}`)).status).toBe(200);
    expect(service.technicianDetail).toHaveBeenLastCalledWith(id, {}, undefined);
    const headers = { Authorization: `Bearer ${jwt.sign({ sub: 'viewer', sid: 'session' })}` };
    expect((await fetch(`${base}/technicians/${id}?latitude=10&longitude=106&userId=other`, { headers })).status).toBe(200);
    expect(service.technicianDetail).toHaveBeenLastCalledWith(id, { latitude: 10, longitude: 106 }, 'viewer');
    expect((await fetch(`${base}/technicians/not-a-uuid`)).status).toBe(400);
  });
  it.each(['sort=invalid', 'available=garbage', 'available=1', 'gender=bad', 'mode=bad', 'categoryId=bad', 'serviceId=bad', 'page=0', 'limit=101', 'tags=', 'latitude=NaN', 'latitude=91&longitude=0', 'longitude=181'])('rejects invalid query %s', async (query) => {
    expect((await fetch(`${base}/technicians?${query}`)).status).toBe(400);
    expect(service.searchTechnicians).not.toHaveBeenCalled();
  });
  it('validates home coordinates and keeps guest access', async () => {
    expect((await fetch(`${base}/home?latitude=nope`)).status).toBe(400);
    expect((await fetch(`${base}/home?latitude=10&longitude=106`)).status).toBe(200);
    expect(service.home).toHaveBeenCalledWith(10, 106, undefined);
  });
  it('forwards only the user from a validated active session', async () => {
    const headers = { Authorization: `Bearer ${jwt.sign({ sub: 'customer', sid: 'session' })}` };
    expect((await fetch(`${base}/technicians?userId=other-user`, { headers })).status).toBe(200);
    expect(service.searchTechnicians).toHaveBeenCalledWith(expect.not.objectContaining({ userId: expect.anything() }), 'customer');
    expect((await fetch(`${base}/home`, { headers })).status).toBe(200);
    expect(service.home).toHaveBeenCalledWith(undefined, undefined, 'customer');
    session.findFirst.mockResolvedValueOnce(null);
    expect((await fetch(`${base}/technicians`, { headers })).status).toBe(401);
  });
  it('rejects supplied invalid and expired tokens instead of trusting them', async () => {
    for (const token of ['invalid', jwt.sign({ sub: 'customer', sid: 'session' }, { expiresIn: -1 })]) {
      expect((await fetch(`${base}/technicians`, { headers: { Authorization: `Bearer ${token}` } })).status).toBe(401);
    }
    expect(service.searchTechnicians).not.toHaveBeenCalled();
  });
});
