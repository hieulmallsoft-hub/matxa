import { Injectable } from '@nestjs/common';
import { Health } from '../entities/health.entity';

@Injectable()
export class HealthService {
  getStatus(): Health {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
