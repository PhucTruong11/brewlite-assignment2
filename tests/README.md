# Kiểm thử Assignment 2

CI chạy `lint → unit test → build` cho web và API. Job tích hợp tạo PostgreSQL `brewlite_test`, áp Prisma migration rồi chạy test tích hợp và E2E. Không dùng DB Supabase production cho các bài test tự động.

| Mức | Tệp/lệnh | Ca chính và kết quả cần kiểm tra |
| --- | --- | --- |
| Unit API | `cd apps/api; npm test` | Xác thực, tính giá/tạo đơn, state machine, khuyến mãi, điểm thưởng, admin; hàm nghiệp vụ độc lập với DB production. |
| Unit web | `cd apps/web; npm test` | Gộp món, tính giỏ, voucher, lưu giỏ; component menu hiển thị loading/rỗng/lỗi/danh sách; trạng thái đơn hiển thị đúng bước và lỗi thanh toán. |
| Tích hợp API | `cd apps/api; npm run test:integration` | `GET /api/products/:id`, `POST /api/cart/validate`, `POST /api/orders`, `GET /api/orders/:id`, `POST /api/checkout` trên PostgreSQL test. Kiểm tra thiếu nguyên liệu, payload sai, giá tính lại, tranh chấp kho, phân quyền, thanh toán lỗi, idempotency, thử lại và hết hạn trả kho. |
| E2E API | `cd apps/api; npm run test:e2e` | Menu → đăng nhập → tạo đơn → thanh toán CARD mô phỏng → xem đơn và lịch sử; kiểm tra health, hết hạn và thiếu nguyên liệu. |
| API thủ công | `thunder-collection_brewlite.json`, `brewlite_postman_collection.json` | Demo request/response qua HTTP tới môi trường được chọn. Request ghi dữ liệu có tác động lên DB của môi trường đó. |

Hai lệnh tích hợp/E2E yêu cầu `DATABASE_URL` trỏ tới PostgreSQL test tên `brewlite_test` trên `localhost` hoặc `127.0.0.1` và `E2E_DATABASE=1`. Chạy `npx prisma migrate deploy` trên DB test trước. CI tự tạo DB này. Các test tạo fixture riêng và xóa sau khi chạy.

E2E kiểm tra luồng HTTP bằng Supertest, gateway CARD mô phỏng và link PayOS giả lập. Ca VietQR kiểm tra chữ ký webhook, số tiền và thông báo trùng. Giao dịch PayOS thật cần kiểm tra riêng trên kênh thanh toán đã cấu hình.
