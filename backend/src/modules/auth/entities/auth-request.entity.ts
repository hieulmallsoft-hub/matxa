import { Request } from 'express';
import { AccessTokenPayload } from './access-token-payload.entity';

export interface AuthenticatedRequest extends Request {
  auth: AccessTokenPayload;
}

export interface ClientMetadata {
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
}
