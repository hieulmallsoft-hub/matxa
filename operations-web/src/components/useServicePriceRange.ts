import { useEffect, useState } from 'react';
import { request } from '../api/client';

export type PriceRange = { min: number; max: number };
const DEFAULT_RANGE: PriceRange = { min: 400_000, max: 1_000_000 };
let cached: PriceRange | null = null;

/**
 * The allowed price of a service package, from the admin settings (400.000-1.000.000đ unless lowered to test
 * payments). The server checks it too; this only gives the form the same limits.
 */
export function useServicePriceRange() {
  const [range, setRange] = useState<PriceRange>(cached ?? DEFAULT_RANGE);
  useEffect(() => {
    void request<{ servicePriceMinVnd?: number; servicePriceMaxVnd?: number }>('/admin/settings/booking')
      .then((rules) => {
        cached = { min: rules.servicePriceMinVnd ?? DEFAULT_RANGE.min, max: rules.servicePriceMaxVnd ?? DEFAULT_RANGE.max };
        setRange(cached);
      })
      .catch(() => undefined);
  }, []);
  return range;
}

/** Called after the admin saves new limits, so open pages use them. */
export function forgetServicePriceRange() {
  cached = null;
}
