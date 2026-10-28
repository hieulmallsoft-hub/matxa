import { Body, Controller, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../../auth/entities/access-token-payload.entity';
import { TechnicianContractService } from '../services/technician-contract.service';

@ApiTags('Technician Contract')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('TECHNICIAN')
@Controller('technician/contract')
export class TechnicianContractController {
  constructor(private readonly contracts: TechnicianContractService) {}
  @Get() get(@CurrentAuth() auth: AccessTokenPayload) { return this.contracts.getMine(auth.sub); }
  @Get('template') template() { return this.contracts.templateUrl(); }
  @Post('signature-upload-url') upload(@CurrentAuth() auth: AccessTokenPayload, @Body() body: { contentType?: string; size?: number }) { return this.contracts.signatureUploadUrl(auth.sub, body.contentType, body.size); }
  @Post('sign') sign(@CurrentAuth() auth: AccessTokenPayload, @Body() body: { signatureKey: string }) { return this.contracts.sign(auth.sub, body.signatureKey); }
}

@ApiTags('Admin Technician Contracts')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/technician-contracts')
export class AdminTechnicianContractController {
  constructor(private readonly contracts: TechnicianContractService) {}
  @Get() list() { return this.contracts.listAdmin(); }
  @Post('template-upload-url') templateUpload(@Body() body: { fileName: string; contentType: string }) { return this.contracts.templateUploadUrl(body.fileName, body.contentType); }
  @Post('template-upload')
  @UseInterceptors(FileInterceptor('file'))
  templateUploadFile(@UploadedFile() file: any) { return this.contracts.uploadTemplateFile(file); }
  @Patch('template') setTemplate(@Body() body: { storageKey: string; fileName: string; contentType: string }) { return this.contracts.setTemplate(body.storageKey, body.fileName, body.contentType); }
  @Patch(':id/review') review(@CurrentAuth() auth: AccessTokenPayload, @Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED'; reason?: string }) { return this.contracts.review(auth.sub, id, body.status, body.reason); }
  @Get(':id/download-url') download(@Param('id') id: string) { return this.contracts.downloadUrl(id); }
}
