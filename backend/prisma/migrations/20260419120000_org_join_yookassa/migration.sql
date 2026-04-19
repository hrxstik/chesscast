-- CreateEnum
CREATE TYPE "OrganizationJoinPolicy" AS ENUM ('OPEN', 'INVITE_ONLY');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "joinPolicy" "OrganizationJoinPolicy" NOT NULL DEFAULT 'INVITE_ONLY';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "yookassaPaymentMethodId" TEXT;
