import { Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenPayload } from '../auth/entities/access-token-payload.entity';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LEGAL_AUDIENCES, LegalAudience, LegalService } from './legal.service';

class UploadLegalDocumentDto {
  @ApiPropertyOptional({ example: 'PRIVACY_POLICY', description: 'Ma van ban. Bo trong thi tao tu ten. Trung ma = phien ban moi.' })
  @IsOptional() @IsString() @MaxLength(60) code?: string;
  @IsString() @MaxLength(200) title!: string;
  @IsIn(LEGAL_AUDIENCES as unknown as string[]) audience!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

@ApiTags('Legal Documents')
@Controller('legal-documents')
export class LegalController {
  constructor(private readonly legal: LegalService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sach dieu khoan & chinh sach (phien ban moi nhat)',
    description: 'Khong can dang nhap. audience=TECHNICIAN tra van ban cho KTV va van ban chung (ALL).',
  })
  @ApiQuery({ name: 'audience', required: false, enum: LEGAL_AUDIENCES })
  list(@Query('audience') audience?: string) {
    return this.legal.list(LEGAL_AUDIENCES.includes(audience as LegalAudience) ? (audience as LegalAudience) : undefined);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Mot van ban: link PDF tam thoi (600 giay)', description: 'Khong can dang nhap. 404 neu chua dang.' })
  get(@Param('code') code: string) {
    return this.legal.get(code);
  }
}

@ApiTags('Admin Legal Documents')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/legal-documents')
export class AdminLegalController {
  constructor(private readonly legal: LegalService) {}

  @Get()
  @ApiOperation({ summary: 'Tat ca van ban kem lich su phien ban' })
  list() {
    return this.legal.adminList();
  }

  @Post('upload')
  @ApiOperation({ summary: 'Dang van ban PDF: ma moi = van ban moi, ma da co = phien ban moi' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title', 'audience'],
      properties: {
        file: { type: 'string', format: 'binary' },
        code: { type: 'string', example: 'PRIVACY_POLICY' },
        title: { type: 'string', example: 'Chính sách bảo mật và bảo vệ dữ liệu cá nhân' },
        audience: { type: 'string', enum: [...LEGAL_AUDIENCES] },
        sortOrder: { type: 'number', example: 0 },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10_000_000 } }))
  upload(@CurrentAuth() auth: AccessTokenPayload, @UploadedFile() file: any, @Body() dto: UploadLegalDocumentDto) {
    return this.legal.upload(auth.sub, file, dto);
  }

  @Delete(':code')
  @ApiOperation({ summary: 'An van ban khoi app (dang lai = phien ban moi)' })
  hide(@Param('code') code: string) {
    return this.legal.hide(code);
  }
}
