const REQUIRED_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REFRESH_TOKEN_PEPPER',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
] as const;

export function validateEnvironment(config: Record<string, unknown>) {
  for (const key of REQUIRED_KEYS) {
    if (typeof config[key] !== 'string' || config[key].trim().length === 0) {
      throw new Error(`Bien moi truong ${key} la bat buoc`);
    }
  }

  assertMinimumSecretLength(config, 'JWT_SECRET');
  assertMinimumSecretLength(config, 'REFRESH_TOKEN_PEPPER');

  const refreshDays = Number(config.REFRESH_TOKEN_TTL_DAYS ?? 30);
  if (!Number.isInteger(refreshDays) || refreshDays < 1 || refreshDays > 365) {
    throw new Error('REFRESH_TOKEN_TTL_DAYS phai la so nguyen tu 1 den 365');
  }

  return { ...config, REFRESH_TOKEN_TTL_DAYS: refreshDays };
}

function assertMinimumSecretLength(
  config: Record<string, unknown>,
  key: 'JWT_SECRET' | 'REFRESH_TOKEN_PEPPER',
): void {
  if ((config[key] as string).length < 32) {
    throw new Error(`${key} phai co it nhat 32 ky tu`);
  }
}
