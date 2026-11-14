ALTER TABLE "promotions" ADD COLUMN "redemptionLimit" INTEGER;

ALTER TABLE "promotions" ADD CONSTRAINT "promotions_redemptionLimit_check"
CHECK ("redemptionLimit" IS NULL OR ("isRewardOnly" AND "redemptionLimit" > 0));

CREATE INDEX "user_vouchers_promotionId_idx" ON "user_vouchers"("promotionId");
