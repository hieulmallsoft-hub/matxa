-- Reasons the person sees when an admin blocks their account or hides their technician profile.
ALTER TABLE "users" ADD COLUMN "blocked_reason" TEXT, ADD COLUMN "blocked_at" TIMESTAMP(3);
ALTER TABLE "technician_profiles" ADD COLUMN "hidden_reason" TEXT;
