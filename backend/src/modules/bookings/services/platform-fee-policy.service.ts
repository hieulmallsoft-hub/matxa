import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

export type PlatformFeePolicyInput = {
  assignmentMode: 'DIRECT' | 'OPEN_MARKETPLACE';
  grossServiceAmount: Prisma.Decimal | number | string;
  paymentMethod: 'CASH' | 'ONLINE';
  calculatedAt: Date;
};

/**
 * Deliberately zero until commercial fee terms are approved. This is a versioned
 * policy boundary: existing booking snapshots are never recalculated later.
 */
@Injectable()
export class PlatformFeePolicyService {
  calculate(input: PlatformFeePolicyInput) {
    const grossServiceAmount = new Prisma.Decimal(input.grossServiceAmount);
    const platformFee = new Prisma.Decimal(0);
    return {
      grossServiceAmount,
      platformFee,
      technicianEarning: grossServiceAmount.minus(platformFee),
      feePolicyVersion: 'ZERO_V1',
    };
  }
}
