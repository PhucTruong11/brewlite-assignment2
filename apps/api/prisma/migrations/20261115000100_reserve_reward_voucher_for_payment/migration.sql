BEGIN;

ALTER TABLE "user_vouchers" ADD COLUMN "reservedOrderId" TEXT;
CREATE UNIQUE INDEX "user_vouchers_reservedOrderId_key" ON "user_vouchers"("reservedOrderId");
ALTER TABLE "user_vouchers" ADD CONSTRAINT "user_vouchers_reservedOrderId_fkey"
  FOREIGN KEY ("reservedOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_vouchers" ADD CONSTRAINT "user_vouchers_reservation_check"
  CHECK ("reservedOrderId" IS NULL OR ("usedAt" IS NULL AND "usedOrderId" IS NULL));

-- Preserve already issued QR links where a voucher is still available. Do not
-- assume an expired local deadline means PayOS has not collected money.
WITH pending_links AS (
  SELECT o."id", o."userId", p."id" AS "promotionId",
    row_number() OVER (PARTITION BY o."userId", p."id" ORDER BY o."createdAt", o."id") AS position
  FROM "orders" o
  JOIN "payos_payment_links" l ON l."orderId" = o."id"
  JOIN "promotions" p ON p."code" = upper(btrim(o."promoCode")) AND p."isRewardOnly"
  WHERE o."status" IN ('PENDING', 'PAYMENT_FAILED')
),
available_vouchers AS (
  SELECT "id", "userId", "promotionId",
    row_number() OVER (PARTITION BY "userId", "promotionId" ORDER BY "createdAt", "id") AS position
  FROM "user_vouchers"
  WHERE "usedAt" IS NULL AND "usedOrderId" IS NULL
)
UPDATE "user_vouchers" v
SET "reservedOrderId" = o."id"
FROM pending_links o
JOIN available_vouchers a USING ("userId", "promotionId", position)
WHERE v."id" = a."id";

COMMIT;
