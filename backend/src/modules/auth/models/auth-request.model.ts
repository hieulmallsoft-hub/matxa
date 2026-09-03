import { Request } from 'express';
import { AccessTokenPayload } from './access-token-payload.model';

export interface AuthenticatedRequest extends Request {
  auth: AccessTokenPayload;
}

export interface ClientMetadata {
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
}
