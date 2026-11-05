type Point = { latitude?: unknown; longitude?: unknown } | null | undefined;

const coordinate = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number(value));

/** Great-circle distance in km rounded to 0.1, or null when either point has no coordinates. */
export function kmBetween(from: Point, to: Point) {
  const [lat1, lng1, lat2, lng2] = [from?.latitude, from?.longitude, to?.latitude, to?.longitude].map(coordinate);
  if ([lat1, lng1, lat2, lng2].some((value) => value === null || !Number.isFinite(value))) return null;
  // Profiles without a location are stored as 0,0 (a point in the Atlantic), not as null.
  if ((lat1 === 0 && lng1 === 0) || (lat2 === 0 && lng2 === 0)) return null;
  const rad = (v: number) => (v * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2! - lat1!) / 2) ** 2 +
    Math.cos(rad(lat1!)) * Math.cos(rad(lat2!)) * Math.sin(rad(lng2! - lng1!) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))) * 10) / 10;
}

/**
 * Address shown to technicians before they get the booking: the first part (house number and
 * street) is dropped, e.g. "52 Ngõ 15, Tổ 2A, Bạch Mai, Hà Nội" -> "… Tổ 2A, Bạch Mai, Hà Nội".
 */
export function addressPreview(snapshot: any) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const parts = String(snapshot.address ?? snapshot.addressText ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) return `… ${parts.slice(1).join(', ')}`;
  return [snapshot.district, snapshot.city].filter(Boolean).join(', ') || null;
}

/** Tag on a fallback technician card: "Chất lượng" (well reviewed) wins over "Mới" (joined in the last 30 days). */
export function technicianBadge(profile: any): 'QUALITY' | 'NEW' | null {
  if (!profile) return null;
  if (Number(profile.averageRating ?? 0) >= 4.5 && Number(profile.reviewCount ?? 0) >= 10) return 'QUALITY';
  if (profile.createdAt && Date.now() - new Date(profile.createdAt).getTime() < 30 * 86_400_000) return 'NEW';
  return null;
}

/**
 * The travel fee of a home booking: a flat amount once the customer is farther than the threshold from the
 * technician. Nothing for other modes, or when either side has no location (the distance is unknown).
 */
export function travelFeeFor(
  mode: string,
  distanceKm: number | null,
  rules: { travelFeeThresholdKm?: number; travelFeeAmount?: number },
) {
  const amount = Number(rules.travelFeeAmount ?? 0);
  if (mode !== 'HOME' || distanceKm === null || !(amount > 0)) return 0;
  return distanceKm > Number(rules.travelFeeThresholdKm ?? 10) ? amount : 0;
}
