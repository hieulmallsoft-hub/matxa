import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Ho ten hien thi tren ung dung', example: 'Thu Huong' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'], example: 'FEMALE' })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender?: 'MALE' | 'FEMALE' | 'OTHER';

  @ApiPropertyOptional({ description: 'Quoc tich hien thi trong ho so', example: 'Việt Nam' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @ApiPropertyOptional({ description: 'mediaKey tra ve tu API avatar-upload-url' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  avatarKey?: string;
}

export class CreateAvatarUploadUrlDto {
  @ApiProperty({ example: 'avatar.jpg' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'] })
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: 'image/jpeg' | 'image/png' | 'image/webp';

  @ApiProperty({ description: 'Kich thuoc file theo byte', maximum: 5242880, example: 250000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  size!: number;
}
