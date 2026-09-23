import { availabilityRange, buildAvailableSlots } from './availability-slots';

describe('Available start slots', () => {
  const at = (time: string) => new Date(`2030-10-01T${time}:00+07:00`);
  const interval = (start: string, end: string) => ({ startAt: at(start), endAt: at(end) });
  const range = interval('00:00', '23:59');
  const starts = (slots: ReturnType<typeof buildAvailableSlots>) => slots.map((slot) => slot.startAt.toISOString());

  it('subtracts booked intervals, permits touching boundaries and respects total duration', () => {
    const slots = buildAvailableSlots([interval('08:00', '12:00')], [interval('09:00', '10:00')], 60, range, at('07:00'), 30);
    expect(starts(slots)).toEqual(['08:00', '10:00', '10:30', '11:00'].map((time) => at(time).toISOString()));
    expect(slots.every((slot) => +slot.endAt - +slot.startAt === 3600000)).toBe(true);
  });

  it('does not bridge separate adjacent working intervals', () => {
    const slots = buildAvailableSlots([interval('08:00', '09:00'), interval('09:00', '10:00')], [], 90, range, at('07:00'), 30);
    expect(slots).toEqual([]);
  });

  it('merges the effect of overlapping bookings and deduplicates overlapping work windows', () => {
    const windows = [interval('08:00', '12:00'), interval('08:00', '12:00')];
    const slots = buildAvailableSlots(windows, [interval('08:30', '10:00'), interval('09:30', '11:00')], 60, range, at('07:00'), 30);
    expect(starts(slots)).toEqual([at('11:00').toISOString()]);
  });

  it('excludes now/past starts and clips to the requested range', () => {
    const slots = buildAvailableSlots([interval('08:00', '12:00')], [], 60, interval('08:15', '11:00'), at('09:00'), 30);
    expect(starts(slots)).toEqual(['09:30', '10:00'].map((time) => at(time).toISOString()));
  });

  it('handles fully occupied and empty schedules', () => {
    expect(buildAvailableSlots([], [], 60, range, at('07:00'), 30)).toEqual([]);
    expect(buildAvailableSlots([interval('08:00', '12:00')], [interval('07:00', '13:00')], 60, range, at('07:00'), 30)).toEqual([]);
  });

  it('interprets date in Vietnam and emits UTC boundaries', () => {
    const { start, end } = availabilityRange({ date: '2030-10-01' });
    expect(start.toISOString()).toBe('2030-09-30T17:00:00.000Z');
    expect(end.toISOString()).toBe('2030-10-01T17:00:00.000Z');
  });

  it('handles a working interval crossing midnight', () => {
    const start = new Date('2030-10-01T23:00:00+07:00');
    const end = new Date('2030-10-02T02:00:00+07:00');
    const slots = buildAvailableSlots([{ startAt: start, endAt: end }], [], 60, { startAt: start, endAt: end }, at('07:00'), 60);
    expect(slots).toHaveLength(3);
    expect(slots[2].endAt).toEqual(end);
  });

  it.each([{}, { date: '2030-10-01', from: '2030-10-01T00:00:00Z' },
    { from: '2030-10-01T00:00:00Z', to: '2030-12-01T00:00:00Z' },
    { from: 'bad', to: 'bad' }, { from: '2030-10-02T00:00:00Z', to: '2030-10-01T00:00:00Z' }])('rejects invalid range %j', (query) => {
    expect(() => availabilityRange(query)).toThrow();
  });
});
