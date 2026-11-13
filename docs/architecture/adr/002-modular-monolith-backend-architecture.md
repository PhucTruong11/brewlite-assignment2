# ADR 002 — Backend NestJS theo kiến trúc modular monolith

- **Trạng thái** · Chấp thuận
- **Ngày quyết định** · 2026-10-18
- **Nhóm quyết định** · Nhóm phát triển BrewLite
- **Yêu cầu liên quan** · Task 3.1, FR-08, FR-09, FR-12, NFR-03, NFR-07

## Ngữ cảnh

Luồng đặt món cần phối hợp giỏ hàng, tồn kho, ưu đãi, thanh toán và điểm thưởng. Các thay đổi cùng đơn cần được ghi nhất quán trên PostgreSQL.

## Quyết định

Triển khai một ứng dụng NestJS gồm các module theo miền nghiệp vụ. Controller và DTO tiếp nhận, xác thực và kiểm tra dữ liệu HTTP. Service thực thi quy tắc nghiệp vụ và điều phối transaction. Prisma truy cập PostgreSQL.

- `Products` và `Inventory` đọc menu, size, topping, công thức và tồn khả dụng.
- `Orders` tạo đơn, giữ nguyên liệu, lưu snapshot công thức và cung cấp lịch sử.
- `Checkout` xử lý thẻ mô phỏng, PayOS và hết hạn đơn.
- `Promotions` và `Rewards` quản lý khuyến mãi, điểm và voucher.
- `Auth` và `Email` xử lý tài khoản, JWT và gửi OTP. `Admin` xử lý các thao tác tại quầy và quản trị.

## Hệ quả và đánh đổi

Các module có thể dùng chung transaction và cơ chế dependency injection, giúp kiểm thử nghiệp vụ và triển khai một container API. Các module dùng chung tiến trình và tài nguyên. Việc mở rộng một module riêng sẽ cần thay đổi ranh giới triển khai và cách phối hợp dữ liệu.

Đối chiếu [AppModule](../../../apps/api/src/app.module.ts) và [các module API](../../../apps/api/src/modules/).
