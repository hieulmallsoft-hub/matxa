import { ApiProperty } from '@nestjs/swagger';
export class NotificationActionResponseDto {
  @ApiProperty() success!: boolean;
  @ApiProperty() affectedCount!: number;
}
