import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAddressDto } from '../../marketplace/dto/marketplace.dto';
import { BookingsService } from './bookings.service';

describe('technician gets the customer contact number', () => {
  const subject = (addressSnapshot: unknown, accountPhone: string | null) => {
    const prisma: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          customerId: 'customer-1',
          status: 'CONFIRMED',
          assignmentMode: 'DIRECT',
          addressSnapshot,
          technician: { id: 'profile-1', userId: 'tech-1' },
          customer: { displayName: 'Khach' },
        }),
      },
      userIdentity: { findFirst: jest.fn().mockResolvedValue(accountPhone ? { phoneNumber: accountPhone } : null) },
    };
    const service = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    jest.spyOn(service as any, 'requireActiveTechnician').mockResolvedValue(undefined);
    return { service, prisma };
  };

  it('uses the number entered with the booking address first', async () => {
    const { service, prisma } = subject({ address: '12 Ly Thuong Kiet', phone: '0912345678' }, '0900000000');
    await expect(service.technicianJobContact('tech-1', 'booking-1')).resolves.toEqual({
      bookingId: 'booking-1', displayName: 'Khach', phoneNumber: '0912345678', source: 'ADDRESS',
    });
    expect(prisma.userIdentity.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to the account phone when the address has none', async () => {
    const { service } = subject({ address: '12 Ly Thuong Kiet', phone: null }, '0900000000');
    await expect(service.technicianJobContact('tech-1', 'booking-1')).resolves.toMatchObject({ phoneNumber: '0900000000', source: 'ACCOUNT' });
  });
});

describe('address phone field', () => {
  const check = async (phone: unknown) => {
    const dto = plainToInstance(CreateAddressDto, { address: 'A', latitude: 21, longitude: 105, phone });
    return { dto, errors: await validate(dto) };
  };

  it('accepts and cleans a Vietnamese number', async () => {
    const { dto, errors } = await check('0912 345.678');
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe('0912345678');
  });

  it('treats an empty value as "use the account phone"', async () => {
    const { dto, errors } = await check('  ');
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBeNull();
  });

  it('rejects text that is not a phone number', async () => {
    const { errors } = await check('abc');
    expect(errors.map((error) => error.property)).toEqual(['phone']);
  });
});
