# ADR 004 — Thanh toán mô phỏng, VietQR PayOS và Idempotency-Key

- **Trạng thái** · Chấp thuận
- **Ngày quyết định** · 2026-10-22
- **Nhóm quyết định** · Nhóm phát triển BrewLite
- **Yêu cầu liên quan** · Task 3.1, FR-09, FR-10, NFR-02, NFR-03

## Ngữ cảnh

Nhóm cần kiểm thử thanh toán tự động và hỗ trợ VietQR khi có cấu hình PayOS. Yêu cầu gửi lặp hoặc tín hiệu đến đồng thời có thể dẫn tới ghi giao dịch, trừ kho hoặc cộng điểm lặp.

## Quyết định

- **CARD mô phỏng.** `PaymentGatewayService` trả thành công sau khoảng 100 ms. Integration test có thể giả lập kết quả thất bại. Web gửi `POST /api/checkout` với `orderId`, `method` và header `Idempotency-Key`.
- **VietQR.** Backend tạo link PayOS theo số tiền của đơn và lưu mã link. API xác minh chữ ký và đối chiếu giao dịch khi nhận webhook tại `/api/payments/payos-webhook`. Khi đọc trạng thái hoặc xử lý hết hạn, API có thể đối soát trực tiếp với PayOS.
- **Chống xử lý lặp.** `Payment.idempotencyKey` có ràng buộc duy nhất. API kiểm tra quyền trên đơn trước khi tra khóa. Khóa gắn với cùng đơn trả kết quả cũ, khóa đã dùng cho đơn khác bị từ chối. Yêu cầu mới dùng khóa transaction theo key, khóa dòng đơn và kiểm tra lại trước khi ghi.
- **Ghi nhận và hết hạn.** Thanh toán thành công ghi giao dịch, chuyển `PAID`, tiêu thụ tồn và xử lý điểm, voucher trong transaction. Với VietQR, hết hạn kích hoạt đối soát. Đơn còn giữ kho và đã nhận đủ tiền được hoàn tất. API chỉ hủy và trả kho khi xác nhận link đã đóng và chưa nhận tiền.

## Hệ quả và đánh đổi

CARD mô phỏng giúp CI chạy độc lập với cổng bên ngoài. VietQR cần tài khoản PayOS, cấu hình webhook và kết nối mạng. Nếu PayOS phản hồi chậm, dữ liệu sai hoặc mới nhận một phần tiền, giao dịch có thể cần đối soát thêm. Test sử dụng dữ liệu PayOS giả lập để kiểm tra chữ ký, gửi lặp và các tình huống hết hạn.

Đối chiếu [CheckoutController](../../../apps/api/src/modules/checkout/checkout.controller.ts), [CheckoutService](../../../apps/api/src/modules/checkout/checkout.service.ts), [cổng mô phỏng](../../../apps/api/src/modules/checkout/payment-gateway.service.ts) và [test đối soát](../../../apps/api/test/payos-reconciliation.integration-spec.ts).
