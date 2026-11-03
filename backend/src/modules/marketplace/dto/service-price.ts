import { Max, Min } from 'class-validator';

export const SERVICE_PRICE_MIN_VND = 400_000;
export const SERVICE_PRICE_MAX_VND = 1_000_000;
const message = 'Gia dich vu phai tu 400.000d den 1.000.000d';

/** Every service price (catalog or a technician's own) must stay within the allowed range. */
export const ServicePriceRange = (): PropertyDecorator => (target, key) => {
  Min(SERVICE_PRICE_MIN_VND, { message })(target, key);
  Max(SERVICE_PRICE_MAX_VND, { message })(target, key);
};
