import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CancelBookingDto } from './booking.dto';

describe('CancelBookingDto', () => {
  it.each(['WAIT_TOO_LONG', 'NO_LONGER_NEEDED', 'SERVICE_ISSUE', 'PAYMENT_REFUND_ISSUE', 'OTHER'])('accepts %s', async (reasonCode) => {
    expect(await validate(plainToInstance(CancelBookingDto, { reasonCode }))).toHaveLength(0);
  });

  it('rejects an unknown reason code', async () => {
    expect(await validate(plainToInstance(CancelBookingDto, { reasonCode: 'BORED' }))).not.toHaveLength(0);
  });
});
