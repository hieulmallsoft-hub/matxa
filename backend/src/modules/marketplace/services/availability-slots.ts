import { BadRequestException } from '@nestjs/common';

export const BOOKING_TIMEZONE = 'Asia/Ho_Chi_Minh';
const MINUTE = 60_000;
export type TimeInterval = { startAt: Date; endAt: Date };

export function availabilityRange(query: { date?: string; from?: string; to?: string }) {
  if (query.date && (query.from || query.to)) throw new BadRequestException('Chi truyen date hoac from/to');
  if (!query.date && (!query.from || !query.to)) throw new BadRequestException('Can date hoac ca from va to');
  const start = new Date(query.date ? `${query.date}T00:00:00+07:00` : query.from!);
  const end = query.date ? new Date(start.getTime() + 86_400_000) : new Date(query.to!);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 31 * 86_400_000) {
    throw new BadRequestException('Khoang ngay khong hop le, toi da 31 ngay');
  }
  return { start, end };
}

/** Subtract occupied half-open intervals, then enumerate starts on each working interval's grid. */
export function buildAvailableSlots(
  working: TimeInterval[], occupied: TimeInterval[], durationMinutes: number,
  range: TimeInterval, now: Date, stepMinutes: number,
) {
  const duration = durationMinutes * MINUTE;
  const step = stepMinutes * MINUTE;
  if (duration <= 0 || step <= 0) throw new BadRequestException('Thoi luong/step khong hop le');
  const busy = [...occupied].sort((a, b) => +a.startAt - +b.startAt);
  const result = new Map<number, { startAt: Date; endAt: Date }>();
  for (const window of working) {
    const lower = Math.max(+window.startAt, +range.startAt, +now + 1);
    const upper = Math.min(+window.endAt, +range.endAt);
    let cursor = lower;
    const free: Array<[number, number]> = [];
    for (const block of busy) {
      if (+block.endAt <= cursor) continue;
      if (+block.startAt >= upper) break;
      if (+block.startAt > cursor) free.push([cursor, Math.min(+block.startAt, upper)]);
      cursor = Math.max(cursor, +block.endAt);
      if (cursor >= upper) break;
    }
    if (cursor < upper) free.push([cursor, upper]);
    for (const [from, to] of free) {
      const first = +window.startAt + Math.ceil((from - +window.startAt) / step) * step;
      for (let start = first; start + duration <= to; start += step) {
        result.set(start, { startAt: new Date(start), endAt: new Date(start + duration) });
      }
    }
  }
  return [...result.values()].sort((a, b) => +a.startAt - +b.startAt);
}
