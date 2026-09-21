import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { CreateAvatarUploadUrlDto, UpdateProfileDto } from '../dto/profile.dto';
import { AvatarUploadUrlModel, ProfileModel } from '../entities/profile.entity';
import { ProfileService } from '../services/profile.service';
import { ProfileStorageService } from '../services/profile-storage.service';

@ApiTags('Profile')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly storage: ProfileStorageService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Lay ho so cua tai khoan dang nhap' })
  @ApiOkResponse({ type: ProfileModel })
  getMe(@CurrentAuth() auth: AccessTokenPayload) {
    return this.profile.getMe(auth.sub);
  }

  @Post('avatar-upload-url')
  @ApiOperation({ summary: 'Tao presigned URL de mobile upload anh dai dien len S3' })
  @ApiCreatedResponse({ type: AvatarUploadUrlModel })
  avatarUploadUrl(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: CreateAvatarUploadUrlDto) {
    return this.storage.createAvatarUploadUrl(auth.sub, dto);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Cap nhat ho ten, gioi tinh, quoc tich va avatar cua tai khoan' })
  @ApiOkResponse({ type: ProfileModel })
  updateMe(@CurrentAuth() auth: AccessTokenPayload, @Body() dto: UpdateProfileDto) {
    return this.profile.updateMe(auth.sub, dto);
  }
}
