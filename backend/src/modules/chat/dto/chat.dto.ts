import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty() @IsUUID() participantId!: string;
}

export class ListMessagesDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 30, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 30;
}

export class SendMessageDto {
  @ApiProperty({ enum: ['TEXT', 'IMAGE', 'LOCATION'] })
  @IsIn(['TEXT', 'IMAGE', 'LOCATION'])
  type!: 'TEXT' | 'IMAGE' | 'LOCATION';

  @ApiPropertyOptional() @ValidateIf((value) => value.type === 'TEXT') @IsString() @MaxLength(4000) text?: string;
  @ApiPropertyOptional() @ValidateIf((value) => value.type === 'IMAGE') @IsString() @MaxLength(1024) mediaUrl?: string;
  @ApiPropertyOptional() @ValidateIf((value) => value.type === 'IMAGE') @IsString() @MaxLength(1024) mediaKey?: string;
  @ApiPropertyOptional() @ValidateIf((value) => value.type === 'LOCATION') @Type(() => Number) @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @ValidateIf((value) => value.type === 'LOCATION') @Type(() => Number) @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() bookingId?: string;
}

export class EditMessageDto {
  @ApiProperty() @IsString() @MaxLength(4000) text!: string;
}

export class CreateUploadUrlDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'] })
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: string;
  @ApiProperty({ maximum: 10485760 }) @Type(() => Number) @IsInt() @Min(1) @Max(10485760) size!: number;
}

export class SocketSendMessageDto extends SendMessageDto {
  @ApiProperty() @IsUUID() conversationId!: string;
}

export class SocketConversationDto {
  @ApiProperty() @IsUUID() conversationId!: string;
}

export class SocketEditMessageDto extends EditMessageDto {
  @ApiProperty() @IsUUID() messageId!: string;
}

export class SocketMessageActionDto {
  @ApiProperty() @IsUUID() messageId!: string;
}
