import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { TechnicianCancelBookingDto } from '../dto/booking.dto';
import { BookingCancellationStorageService } from './booking-cancellation-storage.service';

const EVIDENCE_REQUIRED = new Set(['CUSTOMER_NO_SHOW', 'UNSAFE_SITUATION', 'INAPPROPRIATE_REQUEST']);

@Injectable()
export class TechnicianBookingCancellationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: BookingCancellationStorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async uploadUrl(userId: string, bookingId: string, dto: { contentType: string; size: number }) {
    const booking = await this.assertAssigned(userId, bookingId);
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new BadRequestException('Lich dat khong the huy o trang thai hien tai');
    }
    return this.storage.createUploadUrl(bookingId, userId, dto.contentType, dto.size);
  }

  async cancel(userId: string, bookingId: string, dto: TechnicianCancelBookingDto) {
    const keys = dto.evidenceStorageKeys ?? [];
    this.validateReason(dto, keys);
    await this.assertAssigned(userId, bookingId);
    await this.storage.validateKeys(bookingId, userId, keys);
    const cancelledAt = new Date();
    let result: {
      bookingId: string;
      status: 'CANCELLED';
      cancellation: { actor: 'TECHNICIAN'; reasonCode: string; reasonText: string | null; cancelledAt: Date };
    };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          select: {
            id: true,
            customerId: true,
            technicianId: true,
            assignmentMode: true,
            status: true,
            technician: { select: { userId: true } },
            applications: { where: { status: 'SELECTED' }, select: { technicianProfileId: true } },
          },
        });
        this.assertBookingActor(booking, userId);
        if (booking!.status === 'CANCELLED') throw new ConflictException('BOOKING_ALREADY_CANCELLED');
        if (booking!.status === 'COMPLETED') throw new ConflictException('BOOKING_ALREADY_COMPLETED');
        if (!['PENDING', 'CONFIRMED'].includes(booking!.status))
          throw new BadRequestException('Lich dat khong the huy o trang thai hien tai');
        const activeProfile = await tx.technicianProfile.findFirst({
          where: {
            id: booking!.technicianId!,
            userId,
            isActive: true,
            isVerified: true,
            user: { status: 'ACTIVE', role: 'TECHNICIAN' },
          },
          select: { id: true },
        });
        if (!activeProfile) throw new ForbiddenException('NOT_ASSIGNED_TECHNICIAN');
        await tx.bookingCancellation.create({
          data: {
            bookingId,
            actorUserId: userId,
            actorRole: 'TECHNICIAN',
            reasonCode: dto.reasonCode,
            reasonText: dto.reasonText?.trim() || null,
            cancelledAt,
            evidence: keys.length
              ? { create: keys.map((storageKey) => ({ storageKey, mediaType: 'IMAGE' })) }
              : undefined,
          },
        });
        const update = await tx.booking.updateMany({
          where: { id: bookingId, status: booking!.status },
          data: {
            status: 'CANCELLED',
            cancelledAt,
            cancellationReason: dto.reasonText?.trim() || dto.reasonCode,
            cancellationReasonCode: dto.reasonCode,
            cancellationReasonText: dto.reasonText?.trim() || null,
            cancelledByUserId: userId,
            cancelledByRole: 'TECHNICIAN',
          },
        });
        if (!update.count) throw new ConflictException('Trang thai lich dat da thay doi, vui long tai lai');
        return {
          bookingId,
          status: 'CANCELLED' as const,
          cancellation: {
            actor: 'TECHNICIAN' as const,
            reasonCode: dto.reasonCode,
            reasonText: dto.reasonText?.trim() || null,
            cancelledAt,
          },
        };
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('BOOKING_ALREADY_CANCELLED');
      throw error;
    }
    void this.notifyCancelled(bookingId, userId).catch(() => undefined);
    return result;
  }

  private validateReason(dto: TechnicianCancelBookingDto, keys: string[]) {
    if (dto.reasonCode === 'OTHER' && !dto.reasonText?.trim())
      throw new BadRequestException('Vui long nhap ly do khac');
    if (EVIDENCE_REQUIRED.has(dto.reasonCode) && keys.length === 0) throw new BadRequestException('EVIDENCE_REQUIRED');
  }

  private async assertAssigned(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        technicianId: true,
        assignmentMode: true,
        technician: { select: { userId: true } },
        applications: { where: { status: 'SELECTED' }, select: { technicianProfileId: true } },
      },
    });
    this.assertBookingActor(booking, userId);
    const activeProfile = await this.prisma.technicianProfile.findFirst({
      where: {
        id: booking!.technicianId!,
        userId,
        isActive: true,
        isVerified: true,
        user: { status: 'ACTIVE', role: 'TECHNICIAN' },
      },
      select: { id: true },
    });
    if (!activeProfile) throw new ForbiddenException('NOT_ASSIGNED_TECHNICIAN');
    return booking!;
  }

  private assertBookingActor(
    booking: {
      technicianId: string | null;
      assignmentMode: string;
      technician: { userId: string } | null;
      applications: { technicianProfileId: string }[];
    } | null,
    userId: string,
  ) {
    if (!booking) throw new NotFoundException('BOOKING_NOT_FOUND');
    if (!booking.technicianId || booking.technician?.userId !== userId)
      throw new ForbiddenException('NOT_ASSIGNED_TECHNICIAN');
    if (
      booking.assignmentMode === 'OPEN_MARKETPLACE' &&
      !booking.applications.some((app) => app.technicianProfileId === booking.technicianId)
    )
      throw new ForbiddenException('APPLICATION_NOT_SELECTED');
  }

  private async notifyCancelled(bookingId: string, technicianUserId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { customerId: true } });
    if (!booking) return;
    await this.notifications.create(
      booking.customerId,
      'BOOKING_CANCELLED',
      'Lich hen da huy',
      'Ky thuat vien da huy lich hen.',
      `matxa://bookings/${bookingId}`,
    );
    await this.notifications.sendPush(booking.customerId, 'Lich hen da huy', 'Ky thuat vien da huy lich hen.', {
      type: 'BOOKING_CANCELLED',
      bookingId,
      actor: 'TECHNICIAN',
      technicianUserId,
    });
  }
}
