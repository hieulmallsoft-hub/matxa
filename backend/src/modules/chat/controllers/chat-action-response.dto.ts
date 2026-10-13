import { ApiProperty } from '@nestjs/swagger';
export class ChatReadResponseDto {
  @ApiProperty() conversationId!: string;
  @ApiProperty() updatedCount!: number;
}
