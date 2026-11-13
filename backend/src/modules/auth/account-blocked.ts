import { ForbiddenException } from '@nestjs/common';

/**
 * 403 ACCOUNT_BLOCKED with the admin's reason, so the apps can say the account is locked (and why) instead of
 * treating it as an expired session or a wrong password.
 */
export function accountBlocked(user: { blockedReason?: string | null; blockedAt?: Date | null }) {
  return new ForbiddenException({
    statusCode: 403,
    code: 'ACCOUNT_BLOCKED',
    message: 'Tai khoan da bi khoa',
    reason: user.blockedReason ?? null,
    blockedAt: user.blockedAt ?? null,
  });
}
