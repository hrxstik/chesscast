-- CreateEnum
CREATE TYPE "PlatformAuditType" AS ENUM ('AUTH', 'MODERATION', 'BILLING', 'ORG', 'PLAN');

-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" SERIAL NOT NULL,
    "type" "PlatformAuditType" NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "targetType" TEXT,
    "targetId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAuditLog_type_idx" ON "PlatformAuditLog"("type");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
