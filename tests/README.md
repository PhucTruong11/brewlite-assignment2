# Kiểm thử Assignment 2

CI chạy `lint → unit test → build` cho web và API. Job tích hợp tạo PostgreSQL `brewlite_test`, áp Prisma migration rồi chạy test tích hợp và E2E. Không dùng DB Supabase production cho các bài test tự động.

| Mức | Tệp/lệnh | Ca chính và kết quả cần kiểm tra |
| --- | --- | --- |
| Unit API | `cd apps/api; npm test` | Xác thực, tính giá/tạo đơn, state machine, khuyến mãi, điểm thưởng, admin; hàm nghiệp vụ độc lập với DB production. |
| Unit web | `cd apps/web; npm test` | Gộp món, tính giỏ, voucher, lưu giỏ; component menu hiển thị loading/rỗng/lỗi/danh sách; trạng thái đơn hiển thị đúng bước và lỗi thanh toán. |
| Tích hợp API | `cd apps/api; npm run test:integration` | `GET /api/products/:id`, `POST /api/cart/validate`, `POST /api/orders`, `GET /api/orders/:id`, `POST /api/checkout` trên PostgreSQL test. Kiểm tra thiếu nguyên liệu, payload sai, giá tính lại, tranh chấp kho, phân quyền, thanh toán lỗi, idempotency, thử lại và hết hạn trả kho. |
| E2E API | `cd apps/api; npm run test:e2e` | Một ca dùng cùng phiên cookie từ menu → chi tiết món → đăng nhập → kiểm tra giỏ → tạo đơn → thanh toán CARD mô phỏng → xác nhận PAID và xem lịch sử. Các ca riêng kiểm tra health, hết hạn, thiếu nguyên liệu và VietQR. |
| API thủ công | `thunder-collection_brewlite.json`, `brewlite_postman_collection.json` | Demo request/response qua HTTP tới môi trường được chọn. Request ghi dữ liệu có tác động lên DB của môi trường đó. |

Hai lệnh tích hợp/E2E yêu cầu `DATABASE_URL` trỏ tới PostgreSQL test tên `brewlite_test` trên `localhost` hoặc `127.0.0.1` và `E2E_DATABASE=1`. Chạy `npx prisma migrate deploy` trên DB test trước. CI tự tạo DB này. Các test tạo fixture riêng và xóa sau khi chạy.

E2E tự động kiểm tra luồng HTTP bằng Supertest với PostgreSQL, gateway CARD mô phỏng và link PayOS giả lập. Ca VietQR kiểm tra chữ ký webhook, số tiền và thông báo trùng. Giao dịch PayOS thật cần kiểm tra riêng trên kênh thanh toán đã cấu hình.

`payos-reconciliation.integration-spec.ts` kiểm tra polling thấy PAID khi mất webhook; hết hạn nhưng đã nhận tiền; PayOS timeout; chỉ trả kho sau khi link được xác nhận đóng và chưa nhận tiền; nhận tiền đúng lúc cancel; thanh toán thiếu/sai link; đơn cũ đã trả kho cần đối soát; polling và webhook đồng thời không cộng điểm/trừ kho lặp. Các ca này chạy trong `npm run test:integration` của CI.

## Nghiệm thu qua trình duyệt

Dựng stack local trên DB trống theo [hướng dẫn Docker](../docker/README.md), gồm migration, seed, công thức và tồn mẫu. Đăng nhập bằng tài khoản khách đã xác minh email trong môi trường kiểm thử. Có thể dùng SMTP thử nghiệm hoặc tài khoản fixture đã xác minh.

1. Từ menu, mở chi tiết một món còn hàng, chọn size và thêm vào giỏ.
2. Mở giỏ, kiểm tra món, số lượng và tổng tiền. Bấm **Tiến hành Thanh toán** và kiểm tra URL checkout có `orderId`.
3. Chọn **Thẻ ngân hàng (mô phỏng)**, điền thẻ mẫu và xác nhận thanh toán trong thời hạn hai phút.
4. Kiểm tra hóa đơn có mã đơn, đúng món, số tiền và trạng thái đã thanh toán. Mở chi tiết đơn hoặc lịch sử để đối chiếu mã đơn. Mở lại giỏ và kiểm tra giỏ đã trống.

Lần kiểm tra local ngày 13/11/2026 trên PostgreSQL 16 ghi nhận 62 unit test API, 21 unit test web, 14 integration test, 6 E2E API và 4 test preflight đều pass. Cả bốn migration và các bước seed chạy được trên DB trống. Stack Compose có đủ ba dịch vụ healthy. API và proxy của web đều trả HTTP 200 từ `/api/health`. Luồng Chromium ở trên đã đi đến hóa đơn `PAID`, mở được đơn và thấy giỏ trống sau thanh toán. CI tiếp tục chạy E2E qua API bằng Supertest.
