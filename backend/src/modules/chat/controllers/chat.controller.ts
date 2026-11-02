import { ChatReadResponseDto } from './chat-action-response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { ChatGateway } from '../gateways/chat.gateway';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { ChatStorageService } from '../services/chat-storage.service';
import { ChatService } from '../services/chat.service';
import {
  CreateConversationDto,
  CreateSupportConversationDto,
  ListConversationsDto,
  CreateUploadUrlDto,
  EditMessageDto,
  ListMessagesDto,
  SendMessageDto,
} from '../dto/chat.dto';
import { ConversationModel, MessageListModel, MessageModel, UploadUrlModel } from '../entities/chat.entity';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('conversations')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly storage: ChatStorageService,
    private readonly gateway: ChatGateway,
  ) {}

  @Post('support')
  @ApiOperation({
    summary:
      'Mo hoac tao chat CSKH: khach mo hoi thoai cua chinh minh (khong can body); admin truyen customerId. ' +
      'Khach truyen venueId (nut "Nhan de dat") thi backend gui them tin hoi dat lich tai dia diem do.',
  })
  @ApiCreatedResponse({ type: ConversationModel })
  async createSupport(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateSupportConversationDto) {
    // Check the venue first so a bad venueId does not leave a half-done request behind.
    const inquiry = dto.venueId ? await this.chat.venueInquiryText(dto.venueId) : null;
    const conversation = await this.chat.createSupportConversation(auth.sub, dto.customerId);
    if (!inquiry || conversation.supportCustomerId !== auth.sub) return conversation;
    const message = await this.chat.sendMessage(auth.sub, conversation.id, { type: 'TEXT', text: inquiry });
    await this.gateway.publishRestMessage(message);
    return { ...conversation, inquiryMessage: message };
  }

  @Post()
  @ApiOperation({ summary: 'Deprecated: chat moi phai duoc tao theo booking' })
  @ApiCreatedResponse({ type: ConversationModel })
  create(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateConversationDto) {
    return this.chat.createConversation(auth.sub, dto);
  }

  @Post('booking/:bookingId')
  @ApiOperation({ summary: 'Tao hoac mo chat cua booking; participant duoc lay tu Booking' })
  @ApiCreatedResponse({ type: ConversationModel })
  createForBooking(@CurrentAuth() auth: AccessTokenPayload, @Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.chat.createBookingConversation(auth.sub, bookingId);
  }

  @Get()
  @ApiOperation({ summary: 'Lay danh sach cuoc tro chuyen' })
  @ApiOkResponse({ type: [ConversationModel] })
  list(@CurrentAuth() auth: AccessTokenPayload, @Query() query: ListConversationsDto) {
    return this.chat.listConversations(auth.sub, query.type);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Lay lich su tin nhan; ADMIN co the tra cuu khieu nai' })
  @ApiOkResponse({ type: MessageListModel })
  messages(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.chat.listMessages(auth.sub, id, query);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Gui tin nhan text, anh hoac vi tri' })
  @ApiCreatedResponse({ type: MessageModel })
  async send(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto) {
    const message = await this.chat.sendMessage(auth.sub, id, dto);
    await this.gateway.publishRestMessage(message);
    return message;
  }

  @Post(':id/image-upload-url')
  @ApiOperation({ summary: 'Tao presigned URL de mobile upload anh truc tiep len S3' })
  @ApiCreatedResponse({ type: UploadUrlModel })
  async uploadUrl(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateUploadUrlDto,
  ) {
    await this.chat.ensureMember(auth.sub, id);
    return this.storage.createUploadUrl(id, auth.sub, dto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Danh dau cac tin cua doi phuong la da doc' })
  @ApiOkResponse({ type: ChatReadResponseDto })
  markRead(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.markRead(auth.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'An/xoa cuoc tro chuyen chi o phia minh' })
  @ApiNoContentResponse()
  hide(@CurrentAuth() auth: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.hideConversation(auth.sub, id);
  }

  @Patch('messages/:messageId')
  @ApiOperation({ summary: 'Sua tin nhan text cua minh trong 15 phut' })
  @ApiOkResponse({ type: MessageModel })
  edit(
    @CurrentAuth() auth: AccessTokenPayload,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.chat.editMessage(auth.sub, messageId, dto);
  }

  @Delete('messages/:messageId/recall')
  @ApiOperation({ summary: 'Thu hoi tin nhan cua minh trong 15 phut' })
  @ApiOkResponse({ type: MessageModel })
  recall(@CurrentAuth() auth: AccessTokenPayload, @Param('messageId', ParseUUIDPipe) messageId: string) {
    return this.chat.recallMessage(auth.sub, messageId);
  }
}
