import { BadRequestException } from '@nestjs/common';
import { Prisma, ServiceMode } from '../../../generated/prisma/client';

// Publication rules shared by detail, favorites and bookable service selection.
// Only admin-verified profiles may be published or accept new bookings.
export const publicTechnicianWhere = {
  isActive: true, isVerified: true, user: { status: 'ACTIVE' as const },
  services: { some: { isActive: true, category: { isActive: true } } },
} satisfies Prisma.TechnicianProfileWhereInput;

export async function loadBookableServices(
  db: Pick<Prisma.TransactionClient, 'technicianService'>,
  technicianId: string, serviceIds: string[], mode: ServiceMode,
) {
  const ids = [...new Set(serviceIds)];
  if (!ids.length || ids.length > 10) throw new BadRequestException('Can chon tu 1 den 10 dich vu');
  const services = await db.technicianService.findMany({ where: {
    id: { in: ids }, technicianId, isActive: true, category: { isActive: true },
    technician: { isActive: true, isVerified: true, user: { status: 'ACTIVE' }, serviceModes: { has: mode } },
  } });
  if (services.length !== ids.length) throw new BadRequestException('Co dich vu khong hop le hoac ky thuat vien khong con hoat dong');
  if (services.some((item) => !item.modes.includes(mode))) throw new BadRequestException('Dich vu khong ho tro hinh thuc da chon');
  if (services.some((item) => item.durationMinutes <= 0)) throw new BadRequestException('Thoi luong dich vu khong hop le');
  return ids.map((id) => services.find((item) => item.id === id)!);
}
