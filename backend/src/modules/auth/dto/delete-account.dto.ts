import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Bat buoc voi tai khoan dang ky bang email (hasPassword = true)' })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  password?: string;
}
