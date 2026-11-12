import { BadRequestException } from '@nestjs/common';
import { Prisma, ServiceMode } from '../../../generated/prisma/client';

// Publication rules shared by detail, favorites and bookable service selection.
/**
 * A technician's service is on offer only while it, its category and its catalog service are active. Hiding a catalog
 * service hides every technician's offer of it, and showing it again brings them back; the technician's own on/off is
 * kept. Older services without a catalog entry cannot be booked (bookings go through the catalog), so they are not
 * shown either.
 */
export const offeredServiceWhere = {
  isActive: true,
  category: { isActive: true },
  catalogServiceId: { not: null },
  NOT: { catalogService: { is: { isActive: false } } },
} satisfies Prisma.TechnicianServiceWhereInput;

// Only admin-verified profiles may be published or accept new bookings.
export const publicTechnicianWhere = {
  isActive: true,
  isVerified: true,
  user: { status: 'ACTIVE' as const, technicianApplication: { is: { status: 'APPROVED' } } },
  services: { some: offeredServiceWhere },
} satisfies Prisma.TechnicianProfileWhereInput;

export async function loadBookableServices(
  db: Pick<Prisma.TransactionClient, 'technicianService'>,
  technicianId: string,
  serviceIds: string[],
  mode: ServiceMode,
) {
  const ids = [...new Set(serviceIds)];
  if (!ids.length || ids.length > 10) throw new BadRequestException('Can chon tu 1 den 10 dich vu');
  const services = await db.technicianService.findMany({
    where: {
      id: { in: ids },
      technicianId,
      ...offeredServiceWhere,
      technician: {
        isActive: true,
        isVerified: true,
        user: { status: 'ACTIVE', technicianApplication: { is: { status: 'APPROVED' } } },
        serviceModes: { has: mode },
      },
    },
  });
  if (services.length !== ids.length)
    throw new BadRequestException('Co dich vu khong hop le hoac ky thuat vien khong con hoat dong');
  if (services.some((item) => !item.modes.includes(mode)))
    throw new BadRequestException('Dich vu khong ho tro hinh thuc da chon');
  if (services.some((item) => item.durationMinutes <= 0))
    throw new BadRequestException('Thoi luong dich vu khong hop le');
  return ids.map((id) => services.find((item) => item.id === id)!);
}

export async function applyPriceOptions(
  db: Pick<Prisma.TransactionClient, 'technicianServicePriceOption'>,
  services: Awaited<ReturnType<typeof loadBookableServices>>,
  priceOptionIds?: string[],
) {
  if (!priceOptionIds?.length)
    return services.map((service) => ({
      ...service,
      priceOptionId: null as string | null,
      priceOptionCode: null as string | null,
    }));
  if (priceOptionIds.length !== services.length || new Set(priceOptionIds).size !== priceOptionIds.length)
    throw new BadRequestException('priceOptionIds phai tuong ung mot-mot voi serviceIds');
  const options = await db.technicianServicePriceOption.findMany({
    where: { id: { in: priceOptionIds }, isActive: true },
  });
  if (options.length !== priceOptionIds.length)
    throw new BadRequestException('Goi gia khong hop le hoac da ngung hoat dong');
  return services.map((service, index) => {
    const option = options.find((item) => item.id === priceOptionIds[index]);
    if (!option || option.technicianServiceId !== service.id)
      throw new BadRequestException('Goi gia khong thuoc dich vu da chon');
    return {
      ...service,
      durationMinutes: option.durationMinutes,
      price: option.price,
      priceOptionId: option.id,
      priceOptionCode: option.code,
    };
  });
}
