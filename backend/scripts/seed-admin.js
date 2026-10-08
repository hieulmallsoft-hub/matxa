'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('dotenv/config');
const node_crypto_1 = require('node:crypto');
const node_util_1 = require('node:util');
const adapter_pg_1 = require('@prisma/adapter-pg');
const client_1 = require('../src/generated/prisma/client');
const scryptAsync = (0, node_util_1.promisify)(node_crypto_1.scrypt);
async function hashPassword(password) {
  const salt = (0, node_crypto_1.randomBytes)(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}
async function main() {
  const databaseUrl = required('DATABASE_URL');
  const email = required('ADMIN_EMAIL').trim().toLowerCase();
  const password = required('ADMIN_PASSWORD');
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || 'Matxa Administrator';
  const resetPassword = process.env.ADMIN_RESET_PASSWORD === 'true';
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('ADMIN_EMAIL khong hop le');
  if (password.length < 8 || password.length > 72) throw new Error('ADMIN_PASSWORD phai dai tu 8 den 72 ky tu');
  const prisma = new client_1.PrismaClient({ adapter: new adapter_pg_1.PrismaPg({ connectionString: databaseUrl }) });
  try {
    const identity = await prisma.userIdentity.findUnique({
      where: { provider_providerSubject: { provider: client_1.AuthProvider.EMAIL, providerSubject: email } },
      select: { id: true, userId: true },
    });
    const passwordHash = !identity || resetPassword ? await hashPassword(password) : undefined;
    const user = await prisma.$transaction(async (tx) => {
      if (!identity) {
        const created = await tx.user.create({ data: { displayName, role: 'ADMIN', status: 'ACTIVE' } });
        await tx.userIdentity.create({
          data: {
            userId: created.id,
            provider: client_1.AuthProvider.EMAIL,
            providerSubject: email,
            email,
            emailVerified: true,
            passwordHash: passwordHash,
          },
        });
        return created;
      }
      const updated = await tx.user.update({
        where: { id: identity.userId },
        data: { role: 'ADMIN', status: 'ACTIVE', displayName },
      });
      if (passwordHash)
        await tx.userIdentity.update({ where: { id: identity.id }, data: { passwordHash, emailVerified: true } });
      return updated;
    });
    console.info(`Admin da san sang: ${email} (${user.id})`);
    if (identity && !resetPassword)
      console.info('Mat khau hien tai duoc giu nguyen. Dat ADMIN_RESET_PASSWORD=true neu can reset.');
  } finally {
    await prisma.$disconnect();
  }
}
function required(key) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} la bat buoc`);
  return value;
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
//# sourceMappingURL=seed-admin.js.map
