CREATE TABLE "payos_payment_links" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "checkoutUrl" TEXT NOT NULL,
    "qrCodeUrl" TEXT NOT NULL,
    "bankBin" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "transferContent" TEXT NOT NULL,
    CONSTRAINT "payos_payment_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payos_payment_links_orderId_key" ON "payos_payment_links"("orderId");

ALTER TABLE "payos_payment_links" ADD CONSTRAINT "payos_payment_links_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
