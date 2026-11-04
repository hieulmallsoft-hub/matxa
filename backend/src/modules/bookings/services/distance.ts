type Point = { latitude?: unknown; longitude?: unknown } | null | undefined;

const coordinate = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number(value));

/** Great-circle distance in km rounded to 0.1, or null when either point has no coordinates. */
export function kmBetween(from: Point, to: Point) {
  const [lat1, lng1, lat2, lng2] = [from?.latitude, from?.longitude, to?.latitude, to?.longitude].map(coordinate);
  if ([lat1, lng1, lat2, lng2].some((value) => value === null || !Number.isFinite(value))) return null;
  const rad = (v: number) => (v * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2! - lat1!) / 2) ** 2 +
    Math.cos(rad(lat1!)) * Math.cos(rad(lat2!)) * Math.sin(rad(lng2! - lng1!) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))) * 10) / 10;
}
