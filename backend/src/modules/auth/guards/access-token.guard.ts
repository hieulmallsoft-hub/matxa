import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../database/prisma.service';
import { AccessTokenPayload } from '../models/access-token-payload.model';
import { AuthenticatedRequest } from '../models/auth-request.model';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Thieu access token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
      const session = await this.prisma.session.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: { status: 'ACTIVE' },
        },
        select: { id: true },
      });

      if (!session) {
        throw new UnauthorizedException();
      }

      request.auth = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Access token khong hop le hoac da het han');
    }
  }

  private extractBearerToken(header?: string): string | undefined {
    const [type, token] = header?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
