import { Max, Min } from 'class-validator';

/**
 * Only a sanity bound here: the allowed range is the admin's setting (400.000-1.000.000đ by default), checked by
 * assertServicePrices where the price is saved.
 */
export const ServicePriceRange = (): PropertyDecorator => (target, key) => {
  Min(1000, { message: 'Gia dich vu toi thieu 1.000d' })(target, key);
  Max(100_000_000, { message: 'Gia dich vu qua lon' })(target, key);
};
