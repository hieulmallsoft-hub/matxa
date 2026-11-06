import { confirmationDeadline } from './distance';

describe('how long a new booking waits for technicians', () => {
  const now = new Date('2026-11-06T02:00:00Z');
  const minutes = (value: number) => new Date(now.getTime() + value * 60_000);

  it('waits the admin time (10 minutes) by default', () => {
    expect(confirmationDeadline(now, minutes(120), null, 10)).toEqual(minutes(10));
  });

  it('gives 10 minutes even when the app asks for 5', () => {
    expect(confirmationDeadline(now, minutes(120), minutes(5), 10)).toEqual(minutes(10));
  });

  it('keeps a longer wait the app asks for', () => {
    expect(confirmationDeadline(now, minutes(120), minutes(30), 10)).toEqual(minutes(30));
  });

  it('closes before the booking starts when it starts sooner than the wait', () => {
    expect(confirmationDeadline(now, minutes(8), null, 10)).toEqual(minutes(7));
    expect(confirmationDeadline(now, minutes(8), minutes(5), 10)).toEqual(minutes(5));
  });
});
