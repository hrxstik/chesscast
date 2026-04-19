-- Попытки автопродления: счётчик неуспехов и отложенный retry.
ALTER TABLE "Subscription" ADD COLUMN "renewalFailureCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "renewalNextRetryAt" TIMESTAMP(3);
