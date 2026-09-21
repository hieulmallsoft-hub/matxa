import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer, WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../../database/prisma.service';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { ChatService } from '../services/chat.service';
import { SocketConversationDto, SocketEditMessageDto, SocketMessageActionDto, SocketSendMessageDto } from '../dto/chat.dto';

type AuthSocket = Socket & { data: { userId?: string; activeConversationId?: string } };

@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
  ) {}

  async handleConnection(client: AuthSocket) {
    try {
      const rawHeader = client.handshake.headers.authorization;
      const token = client.handshake.auth?.token ?? (rawHeader?.startsWith('Bearer ') ? rawHeader.slice(7) : undefined);
      if (!token) throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      const session = await this.prisma.session.findFirst({
        where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() }, user: { status: 'ACTIVE' } },
        select: { id: true },
      });
      if (!session) throw new Error('invalid session');
      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);
    } catch {
      client.emit('auth.error', { message: 'Access token khong hop le hoac da het han' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthSocket) {
    this.logger.debug(`Chat socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('conversation.open')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async open(@ConnectedSocket() client: AuthSocket, @MessageBody() dto: SocketConversationDto) {
    const userId = this.userId(client);
    await this.chat.ensureMember(userId, dto.conversationId);
    client.data.activeConversationId = dto.conversationId;
    await client.join(`conversation:${dto.conversationId}`);
    return { event: 'conversation.opened', data: { conversationId: dto.conversationId } };
  }

  @SubscribeMessage('conversation.close')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async close(@ConnectedSocket() client: AuthSocket, @MessageBody() dto: SocketConversationDto) {
    client.data.activeConversationId = undefined;
    await client.leave(`conversation:${dto.conversationId}`);
    return { event: 'conversation.closed', data: { conversationId: dto.conversationId } };
  }

  @SubscribeMessage('message.send')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async send(@ConnectedSocket() client: AuthSocket, @MessageBody() dto: SocketSendMessageDto) {
    const userId = this.userId(client);
    const message = await this.chat.sendMessage(userId, dto.conversationId, dto, false);
    const recipients = await this.chat.recipientIds(userId, dto.conversationId);
    const recipientRooms = recipients.map((recipientId) => `user:${recipientId}`);
    let recipientOnline = false;
    let recipientViewingConversation = false;
    for (const recipientId of recipients) {
      const sockets = await this.server.in(`user:${recipientId}`).fetchSockets();
      recipientOnline ||= sockets.length > 0;
      recipientViewingConversation ||= sockets.some((socket) => socket.data.activeConversationId === dto.conversationId);
    }
    if (recipientOnline) await this.chat.markDelivered(message.id);
    this.chat.notifyInBackground(userId, dto.conversationId, message.id, dto, !recipientViewingConversation);
    this.server.to([`conversation:${dto.conversationId}`, ...recipientRooms]).emit('message.created', message);
    return { event: 'message.sent', data: message };
  }

  @SubscribeMessage('message.edit')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async edit(@ConnectedSocket() client: AuthSocket, @MessageBody() dto: SocketEditMessageDto) {
    const message = await this.chat.editMessage(this.userId(client), dto.messageId, dto);
    this.server.to(`conversation:${message.conversationId}`).emit('message.updated', message);
    return { event: 'message.edit.ack', data: message };
  }

  @SubscribeMessage('message.recall')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async recall(@ConnectedSocket() client: AuthSocket, @MessageBody() dto: SocketMessageActionDto) {
    const message = await this.chat.recallMessage(this.userId(client), dto.messageId);
    this.server.to(`conversation:${message.conversationId}`).emit('message.recalled', message);
    return { event: 'message.recall.ack', data: message };
  }

  @SubscribeMessage('message.read')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async read(@ConnectedSocket() client: AuthSocket, @MessageBody() dto: SocketConversationDto) {
    const userId = this.userId(client);
    const result = await this.chat.markRead(userId, dto.conversationId);
    this.server.to(`conversation:${dto.conversationId}`).emit('message.read', { conversationId: dto.conversationId, userId, ...result });
    return { event: 'message.read.ack', data: result };
  }

  @SubscribeMessage('typing.start')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async typingStart(@ConnectedSocket() client: AuthSocket, @MessageBody() dto: SocketConversationDto) {
    const userId = this.userId(client);
    await this.chat.ensureMember(userId, dto.conversationId);
    client.to(`conversation:${dto.conversationId}`).emit('typing.started', { conversationId: dto.conversationId, userId });
  }

  @SubscribeMessage('typing.stop')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async typingStop(@ConnectedSocket() client: AuthSocket, @MessageBody() dto: SocketConversationDto) {
    const userId = this.userId(client);
    await this.chat.ensureMember(userId, dto.conversationId);
    client.to(`conversation:${dto.conversationId}`).emit('typing.stopped', { conversationId: dto.conversationId, userId });
  }

  private userId(client: AuthSocket) {
    if (!client.data.userId) throw new WsException('Chua xac thuc');
    return client.data.userId;
  }
}
