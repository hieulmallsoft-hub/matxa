ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'EMAIL';
ALTER TABLE "user_identities" ADD COLUMN "password_hash" TEXT;
