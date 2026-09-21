import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../generated/prisma/client';

export class ProfileModel {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() displayName?: string | null;
  @ApiPropertyOptional() avatarUrl?: string | null;
  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'] }) gender?: string | null;
  @ApiPropertyOptional() nationality?: string | null;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty() onboardingCompleted!: boolean;
}

export class AvatarUploadUrlModel {
  @ApiProperty() uploadUrl!: string;
  @ApiProperty() mediaUrl!: string;
  @ApiProperty() mediaKey!: string;
  @ApiProperty({ example: 300 }) expiresIn!: number;
}
