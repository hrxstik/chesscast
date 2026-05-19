-- Remove legacy OAuth fields (Google login removed)
ALTER TABLE "User" DROP COLUMN IF EXISTS "provider";
ALTER TABLE "User" DROP COLUMN IF EXISTS "providerId";
