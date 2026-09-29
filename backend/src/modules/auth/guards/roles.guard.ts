import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../database/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../entities/auth-request.entity';

/**
 * Checks roles from the database, not from the JWT, so a changed role takes
 * effect immediately for an existing access token.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.auth?.sub;
    if (!userId) throw new ForbiddenException('Khong co quyen truy cap');
    const user = await this.prisma.user.findFirst({ where: { id: userId, status: 'ACTIVE' }, select: { role: true } });
    if (!user || !requiredRoles.includes(user.role)) throw new ForbiddenException('Chi admin moi co quyen thuc hien');
    return true;
  }
}
