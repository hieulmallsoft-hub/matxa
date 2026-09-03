import { Injectable } from '@nestjs/common';
import { Health } from '../models/health.model';

@Injectable()
export class HealthService {
  getStatus(): Health {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
