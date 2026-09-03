import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Health } from '../models/health.model';
import { HealthService } from '../services/health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Kiem tra backend dang hoat dong' })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', timestamp: '2026-09-03T05:00:00.000Z' },
    },
  })
  getStatus(): Health {
    return this.healthService.getStatus();
  }
}
