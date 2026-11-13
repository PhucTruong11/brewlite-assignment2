# ADR 003 — Tồn kho theo công thức và giữ nguyên liệu tạm thời

- **Trạng thái** · Chấp thuận
- **Ngày quyết định** · 2026-10-20
- **Nhóm quyết định** · Nhóm phát triển BrewLite
- **Yêu cầu liên quan** · Task 3.1, FR-04, FR-08, FR-10, FR-15, NFR-03

## Ngữ cảnh

Nhiều đồ uống, size và topping dùng chung nguyên liệu. Kiểm tra tồn theo từng sản phẩm dễ bỏ sót lượng nguyên liệu chung khi khách đặt đồng thời.

## Quyết định

Dùng PostgreSQL và Prisma. Schema và migration được lưu trong `apps/api/prisma/`. Tạo migration trong môi trường phát triển bằng `prisma migrate dev`. CI và workflow phát hành áp migration đã commit bằng `prisma migrate deploy`.

- Tồn khả dụng bằng `onHand - reserved` đối với nguyên liệu được theo dõi. Kiểm tra giỏ chỉ đọc giá, công thức và tồn.
- Tạo đơn tăng `reserved` bằng cập nhật có điều kiện đủ tồn. API ghi đơn `PENDING`, dòng món và `recipeSnapshot` trong cùng transaction. Hạn giữ kho là hai phút.
- Khi thanh toán thành công, API dùng snapshot để giảm cả `onHand` và `reserved`, rồi ghi `CONSUMED`.
- Khi đơn đủ điều kiện hủy do quá hạn, API giảm `reserved` và ghi `RELEASED`. Nếu có link VietQR, API đối soát PayOS trước khi trả kho. Giao diện cho tạo lại đơn với `orderId` mới sau khi đơn cũ đã hủy. Giới hạn một lượt tạo lại được thực thi phía giao diện.
- Nếu admin hủy đơn `PAID` đã tiêu thụ nguyên liệu, API hoàn tồn theo snapshot, ghi `RESTORED` và thu hồi điểm đã cấp trong giới hạn số dư.

## Hệ quả và đánh đổi

Cập nhật có điều kiện giúp ngăn hai đơn giữ cùng phần tồn cuối. Snapshot giữ định lượng đã dùng tại thời điểm đặt. Nhóm phải duy trì công thức theo size và topping. Khi PayOS chưa xác minh được giao dịch, lượng giữ có thể kéo dài hơn hai phút để tránh giải phóng nhầm.

Đối chiếu [schema](../../../apps/api/prisma/schema.prisma), [InventoryService](../../../apps/api/src/modules/inventory/inventory.service.ts), [OrdersService](../../../apps/api/src/modules/orders/orders.service.ts) và [AdminService](../../../apps/api/src/modules/admin/admin.service.ts).
