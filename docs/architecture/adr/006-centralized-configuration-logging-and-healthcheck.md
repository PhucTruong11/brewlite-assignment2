# ADR 006 — Cấu hình tập trung, ghi log và health check

- **Trạng thái** · Chấp thuận
- **Ngày quyết định** · 2026-10-25
- **Nhóm quyết định** · Nhóm phát triển BrewLite
- **Yêu cầu liên quan** · Task 3.1, NFR-04, NFR-07

## Ngữ cảnh

Local, CI và production dùng cấu hình khác nhau. Workflow triển khai cần một phép kiểm tra chung để biết API và PostgreSQL có thể phản hồi sau rollout.

## Quyết định

- Dùng biến môi trường và `ConfigModule` để nạp `.env` cho API khi chạy local. Các file `.env.example` mô tả cấu hình mẫu. Giá trị production được thiết lập trên Render, Vercel và GitHub Actions. Email hỗ trợ SMTP và Brevo. Tài liệu production sử dụng Brevo.
- `GET /api/health` chạy `SELECT 1` qua Prisma. Thành công trả HTTP 200 và `{"status":"ok","database":"ok"}`. Lỗi kết nối trả HTTP 503 với trạng thái `unavailable`. Workflow smoke test kiểm tra API trực tiếp và qua proxy web.
- Dùng `Logger` của NestJS ở những service cần ghi chẩn đoán, như checkout và email. Chẳng hạn checkout ghi cảnh báo khi PayOS chưa xác nhận trạng thái link hoặc khi giao dịch cần đối soát.

## Hệ quả và đánh đổi

Có thể thay cấu hình API theo môi trường và dùng health check làm điều kiện xác nhận rollout. Đổi địa chỉ proxy web yêu cầu build lại web. Health check phản ánh khả năng phản hồi của API và PostgreSQL tại thời điểm gọi. Việc theo dõi lỗi vẫn phụ thuộc log của môi trường chạy.

Đối chiếu [AppModule](../../../apps/api/src/app.module.ts), [health endpoint](../../../apps/api/src/app.controller.ts), [dịch vụ email](../../../apps/api/src/modules/email/email.service.ts) và [hướng dẫn triển khai](../../deployment.md).
