import { PlatformFeePolicyService } from './platform-fee-policy.service';

describe('PlatformFeePolicyService', () => {
  it('snapshots the approved zero-fee policy without using customer fees or discount', () => {
    const result = new PlatformFeePolicyService().calculate({
      assignmentMode: 'OPEN_MARKETPLACE',
      grossServiceAmount: '500000',
      paymentMethod: 'CASH',
      calculatedAt: new Date(),
    });
    expect(result.grossServiceAmount.toString()).toBe('500000');
    expect(result.platformFee.toString()).toBe('0');
    expect(result.technicianEarning.toString()).toBe('500000');
    expect(result.feePolicyVersion).toBe('ZERO_V1');
  });
});
