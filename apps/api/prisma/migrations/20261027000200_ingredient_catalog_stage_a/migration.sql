-- CreateEnum
CREATE TYPE "IngredientUnit" AS ENUM ('G', 'ML', 'PIECE');

-- CreateEnum
CREATE TYPE "InventoryState" AS ENUM ('LEGACY', 'RESERVED', 'CONSUMED', 'RELEASED', 'RESTORED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "inventoryState" "InventoryState" NOT NULL DEFAULT 'LEGACY',
ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "recipeSnapshot" JSONB;

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "IngredientUnit" NOT NULL,
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "onHand" DECIMAL(14,3),
    "reserved" DECIMAL(14,3),
    "packageQuantity" DECIMAL(14,3),
    "lowStockThreshold" DECIMAL(14,3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ingredients"
    ADD CONSTRAINT "ingredients_stock_shape_check" CHECK (
        ("trackStock" = false AND "onHand" IS NULL AND "reserved" IS NULL)
        OR
        ("trackStock" = true AND "onHand" IS NOT NULL AND "reserved" IS NOT NULL
         AND "onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand")
    ),
    ADD CONSTRAINT "ingredients_package_quantity_check" CHECK (
        "packageQuantity" IS NULL OR "packageQuantity" > 0
    ),
    ADD CONSTRAINT "ingredients_low_stock_threshold_check" CHECK (
        "lowStockThreshold" IS NULL OR "lowStockThreshold" >= 0
    ),
    ADD CONSTRAINT "ingredients_version_check" CHECK ("version" > 0),
    ADD CONSTRAINT "ingredients_piece_stock_check" CHECK (
        "unit" <> 'PIECE' OR
        (("onHand" IS NULL OR "onHand" = trunc("onHand"))
         AND ("reserved" IS NULL OR "reserved" = trunc("reserved")))
    );

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "size" "ProductSize",
    "toppingId" TEXT,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "recipes"
    ADD CONSTRAINT "recipes_owner_check" CHECK (
        ("productId" IS NOT NULL AND "size" IS NOT NULL AND "toppingId" IS NULL)
        OR
        ("productId" IS NULL AND "size" IS NULL AND "toppingId" IS NOT NULL)
    ),
    ADD CONSTRAINT "recipes_quantity_check" CHECK ("quantity" > 0);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_code_key" ON "ingredients"("code");

-- CreateIndex
CREATE INDEX "recipes_ingredientId_idx" ON "recipes"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_productId_size_ingredientId_key" ON "recipes"("productId", "size", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_toppingId_ingredientId_key" ON "recipes"("toppingId", "ingredientId");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_toppingId_fkey" FOREIGN KEY ("toppingId") REFERENCES "toppings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
