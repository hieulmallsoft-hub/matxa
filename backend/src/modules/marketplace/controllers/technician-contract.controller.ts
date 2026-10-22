import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
  @Patch(':id/review') review(@CurrentAuth() auth: AccessTokenPayload, @Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED'; reason?: string }) { return this.contracts.review(auth.sub, id, body.status, body.reason); }
  @Get(':id/download-url') download(@Param('id') id: string) { return this.contracts.downloadUrl(id); }
}
