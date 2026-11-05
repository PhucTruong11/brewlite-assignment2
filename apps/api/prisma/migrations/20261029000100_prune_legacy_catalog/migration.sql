-- Giữ tên và ảnh món trong lịch sử đơn trước khi dọn danh mục cũ.
ALTER TABLE "order_items"
  ADD COLUMN "productName" TEXT,
  ADD COLUMN "productImageUrl" TEXT;

UPDATE "order_items" AS item
SET "productName" = product."name",
    "productImageUrl" = product."imageUrl"
FROM "products" AS product
WHERE item."productId" = product."id";

ALTER TABLE "order_items"
  ALTER COLUMN "productName" SET NOT NULL,
  ALTER COLUMN "productId" DROP NOT NULL;

ALTER TABLE "order_items" DROP CONSTRAINT "order_items_productId_fkey";
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Chỉ giữ sáu món và ba topping đã thống nhất. Xóa công thức cũ trước
-- vì khóa ngoại của recipes không cho xóa sản phẩm/topping đang được tham chiếu.
DELETE FROM "recipes"
WHERE "productId" IN (
  SELECT "id" FROM "products"
  WHERE "name" NOT IN (
    'Phin Đen Đá', 'Phin Sữa Đá', 'Bạc Xỉu',
    'Americano', 'Caramel Macchiato', 'Trà Thanh Đào'
  )
)
OR "toppingId" IN (
  SELECT "id" FROM "toppings"
  WHERE "name" NOT IN ('Kem Sữa Mặn', 'Trân Châu Trắng', 'Thạch Cà Phê')
);

DELETE FROM "products"
WHERE "name" NOT IN (
  'Phin Đen Đá', 'Phin Sữa Đá', 'Bạc Xỉu',
  'Americano', 'Caramel Macchiato', 'Trà Thanh Đào'
);

DELETE FROM "toppings"
WHERE "name" NOT IN ('Kem Sữa Mặn', 'Trân Châu Trắng', 'Thạch Cà Phê');
