import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  cities() {
    return this.prisma.city.findMany({ where: { isActive: true }, select: { code: true, name: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async districts(cityCode: string) {
    const city = await this.prisma.city.findFirst({ where: { code: cityCode, isActive: true }, select: { code: true } });
    if (!city) throw new NotFoundException('Thanh pho khong ton tai');
    return this.prisma.district.findMany({ where: { cityCode, isActive: true }, select: { code: true, name: true, cityCode: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }
}
