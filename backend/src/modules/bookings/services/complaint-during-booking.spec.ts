import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

// "KTV không liên hệ, không đến" happens while the booking is still on, so a customer must be able
// to complain about a confirmed booking, not only after it is completed or cancelled.
describe('complaints while the booking is in progress', () => {
  const subject = (status: string) => {
    const prisma: any = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({ id: 'booking-1', status, complaint: null }),
        findUnique: jest.fn().mockResolvedValue({ customerId: 'customer-1', status }),
      },
      complaint: { create: jest.fn(async ({ data }: any) => ({ id: 'complaint-1', ...data })) },
    };
    const service = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    return { service, prisma };
  };
  const dto = { reasonCode: 'TECHNICIAN_NO_CONTACT', detail: 'KTV khong den', contactEmail: 'a@b.com' } as any;

  it.each(['CONFIRMED', 'COMPLETED', 'CANCELLED'])('accepts a complaint on a %s booking', async (status) => {
    const { service, prisma } = subject(status);
    await expect(service.createComplaint('customer-1', 'booking-1', dto)).resolves.toMatchObject({ id: 'complaint-1' });
    expect(prisma.complaint.create).toHaveBeenCalled();
    await expect(service.assertComplaintUploadAllowed('customer-1', 'booking-1')).resolves.toBeUndefined();
  });

  it.each(['OPEN', 'PENDING', 'EXPIRED'])('still refuses a booking nobody took (%s)', async (status) => {
    const { service, prisma } = subject(status);
    await expect(service.createComplaint('customer-1', 'booking-1', dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.complaint.create).not.toHaveBeenCalled();
    await expect(service.assertComplaintUploadAllowed('customer-1', 'booking-1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
