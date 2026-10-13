import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../../database/prisma.service';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { MarketplaceRealtimeService } from '../services/marketplace-realtime.service';

type AuthSocket = Socket & { data: { userId?: string } };

@WebSocketGateway({ namespace: '/marketplace' })
export class MarketplaceGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly realtime: MarketplaceRealtimeService,
  ) {}

  async handleConnection(client: AuthSocket) {
    try {
      const raw = client.handshake.headers.authorization;
      const token = client.handshake.auth?.token ?? (raw?.startsWith('Bearer ') ? raw.slice(7) : undefined);
      if (!token) throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
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
      if (!session) throw new Error('invalid session');
      client.data.userId = payload.sub;
      this.realtime.attach(this.server);
    } catch {
      client.emit('auth.error', { message: 'Access token khong hop le hoac da het han' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('matching.subscribe')
  async subscribe(@ConnectedSocket() client: AuthSocket) {
    if (!client.data.userId) return { event: 'matching.error', data: { message: 'Chua xac thuc' } };
    await client.join('marketplace:matching');
    return { event: 'matching.subscribed', data: { realtime: true } };
  }

  @SubscribeMessage('matching.unsubscribe')
  async unsubscribe(@ConnectedSocket() client: AuthSocket) {
    await client.leave('marketplace:matching');
    return { event: 'matching.unsubscribed', data: { realtime: false } };
  }
}
