const REQUIRED_KEYS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'REFRESH_TOKEN_PEPPER',
  'OTP_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'GOOGLE_CLIENT_ID',
] as const;

export function validateEnvironment(config: Record<string, unknown>) {
  for (const key of REQUIRED_KEYS) {
    if (typeof config[key] !== 'string' || config[key].trim().length === 0) {
      throw new Error(`Bien moi truong ${key} la bat buoc`);
    }
  }

  assertMinimumSecretLength(config, 'JWT_SECRET');
  assertMinimumSecretLength(config, 'REFRESH_TOKEN_PEPPER');
  assertMinimumSecretLength(config, 'OTP_SECRET');

  const refreshDays = Number(config.REFRESH_TOKEN_TTL_DAYS ?? 30);
  if (!Number.isInteger(refreshDays) || refreshDays < 1 || refreshDays > 365) {
    throw new Error('REFRESH_TOKEN_TTL_DAYS phai la so nguyen tu 1 den 365');
  }

  const integerSettings = {
    OTP_TTL_SECONDS: [300, 60, 600],
    OTP_RESEND_SECONDS: [60, 30, 300],
    OTP_MAX_ATTEMPTS: [5, 1, 10],
    OTP_PHONE_LIMIT_PER_HOUR: [5, 1, 100],
    OTP_IP_LIMIT_PER_HOUR: [20, 1, 1000],
    OTP_DEVICE_LIMIT_PER_HOUR: [10, 1, 500],
  } as const;
  const parsedSettings: Record<string, number> = {};
  for (const [key, [fallback, minimum, maximum]] of Object.entries(
    integerSettings,
  )) {
    const value = Number(config[key] ?? fallback);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${key} phai la so nguyen tu ${minimum} den ${maximum}`);
    }
    parsedSettings[key] = value;
  }

  return {
    ...config,
    REFRESH_TOKEN_TTL_DAYS: refreshDays,
    ...parsedSettings,
  };
}

function assertMinimumSecretLength(
  config: Record<string, unknown>,
  key: 'JWT_SECRET' | 'REFRESH_TOKEN_PEPPER' | 'OTP_SECRET',
): void {
  if ((config[key] as string).length < 32) {
    throw new Error(`${key} phai co it nhat 32 ky tu`);
  }
}
