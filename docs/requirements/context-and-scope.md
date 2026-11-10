# Task 1.1 — Bối cảnh, stakeholder và phạm vi

Bản trình bày LaTeX nằm tại [task1/main.tex](task1/main.tex). Nội dung dưới đây là bản Markdown bắt buộc theo đề Assignment 2.

## Vấn đề nghiệp vụ

Khách cần biết món, giá theo size/topping và khả năng đáp ứng trước khi đặt. Cửa hàng cần tránh bán vượt nguyên liệu, nhận đúng đơn đã thanh toán, theo dõi pha chế và giao tại quầy. BrewLite nối luồng xem menu → chọn món → giỏ → tạo đơn → thanh toán → theo dõi đơn; giá, quyền và tồn kho được xác minh ở API.

## Stakeholder

| Đối tượng | Mục tiêu, kỳ vọng | Cách xác nhận |
| --- | --- | --- |
| Khách hàng | Đặt đúng món, biết tổng tiền và trạng thái, dùng voucher/điểm đúng quy tắc. | Demo luồng mua, ca giỏ rỗng, hết nguyên liệu và thanh toán lỗi. |
| Nhân viên quầy | Nhận đơn đã thanh toán, cập nhật pha chế, sẵn sàng và hoàn tất. | Demo danh sách đơn và chuyển trạng thái. |
| Quản lý cửa hàng | Kiểm soát nguyên liệu, công thức, khuyến mãi và doanh thu; tránh thanh toán lặp. | Đối soát tồn, giao dịch, quyền admin. |
| Nhóm phát triển | Phân ranh frontend/API/DB, tích hợp và kiểm thử lặp lại. | Build/test CI, tài liệu triển khai, ma trận truy vết. |

## Mục tiêu và phạm vi

- **MVP, trong phạm vi:** menu, tùy chọn size/topping, giỏ, kiểm tra nguyên liệu theo công thức; xác thực; tạo đơn và giữ nguyên liệu 2 phút; thanh toán thẻ mô phỏng, QR PayOS khi cấu hình hợp lệ; lịch sử/trạng thái đơn; quản trị đơn đã thanh toán, nguyên liệu, công thức và khuyến mãi. Web Next.js, API NestJS, PostgreSQL, CI/CD và URL production HTTPS thuộc sản phẩm giao nộp.
- **Mở rộng:** điểm thưởng, đổi voucher, báo cáo quản trị chi tiết, PWA và kiểm thử tải quy mô lớn hơn dữ liệu demo.
- **Ngoài phạm vi:** giao tận nơi, theo dõi tài xế, nhiều chi nhánh độc lập, tự đối soát mọi ngân hàng/ví và hoàn tiền ngân hàng tự động. QR PayOS chỉ chứng minh tiền thật khi tài khoản và webhook đã được cấu hình; nút CARD là mô phỏng.

## Giả định, ràng buộc và rủi ro

- **Giả định:** Khách nhận đồ tại quầy. Sản phẩm có công thức theo size. Nguyên liệu theo dõi tồn có `available = onHand - reserved`. Đơn chờ thanh toán giữ nguyên liệu 2 phút. Việc tạo đơn mới sau lần hết hạn đầu là quy tắc giao diện cần nghiệm thu riêng.
- **Ràng buộc:** Đề bắt buộc Next.js, NestJS, PostgreSQL. Web trên Vercel, API trên Render, DB trên Supabase. API là nguồn tin cậy cho giá, quyền, tồn và trạng thái. Secret chỉ nằm trong cấu hình môi trường; test phá hủy không dùng DB production.
- **Rủi ro ban đầu:** Free tier ngủ/giới hạn kết nối làm phản hồi đầu chậm; webhook PayOS đến trễ hoặc sai cấu hình; đặt đồng thời tranh chấp nguyên liệu; migration hoặc biến môi trường khác giữa mã nguồn và production gây deploy lỗi. Cần transaction, test cạnh tranh, health check và rollback.
