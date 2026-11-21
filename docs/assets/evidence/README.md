# Minh chứng báo cáo Assignment 2

## Ảnh do nhóm cung cấp

Các PNG dưới đây là bản sao nguyên gốc, không chỉnh sửa nội dung. Báo cáo dùng `trim`/`clip` của LaTeX để phóng vùng liên quan, giữ ảnh gốc để đối chiếu. Thời điểm 19/11/2026 theo tên ảnh nhóm gửi và dashboard; không coi đó là một lần kiểm thử mới ngày cập nhật tài liệu.

| Tệp lưu | Tên ảnh nguồn `Screenshot 2026-11-19 ...` | Nội dung và vị trí báo cáo |
| --- | --- | --- |
| ci-integration-failed.png | 185019.png | Lưu đối chiếu nguồn, không đưa vào báo cáo |
| ci-backend-failed.png | 185030.png | Lưu đối chiếu nguồn, không đưa vào báo cáo |
| render-startup-logs.png | 185750.png | Lưu đối chiếu nguồn, không đưa vào báo cáo |
| ci-success.png | 190259.png | CI #20, PR #10, ba job đạt, backend 67/67 ca; Task 4.4 |
| cd-success.png | 190354.png | CD #14, main SHA 9e35333, các giai đoạn đạt; Task 5.3 |
| vercel-ready.png | 190658.png | Frontend production Ready; Task 5.3 |
| render-live.png | 190813.png | API Live SHA 9e35333; Task 5.3 |
| render-network.png | 190846.png | Lưu đối chiếu nguồn, không đưa vào báo cáo |
| supabase-healthy.png | 191105.png | Project Healthy, Primary Database; Task 5.3 |
| vercel-observability.png | 191231.png | Lưu đối chiếu nguồn, không đưa vào báo cáo |
| vercel-query-readonly.png | 191459.png | Lưu đối chiếu nguồn, không đưa vào báo cáo |

Không suy ra nguyên nhân gốc npm ci chỉ từ đoạn usage/exit code. 67 là số ca unit backend hiển thị, không phải tổng mọi bộ test. Thông tin migration trên Supabase dashboard khác lịch sử Prisma; ảnh không chứng minh có backup do Supabase quản lý. Vercel Functions error/timeout 0% chỉ có ý nghĩa trong phạm vi và khoảng thời gian ảnh. Con số 777 trong màn hình query bị khóa không được dùng như số lỗi API 5xx đã xác minh.

## Minh chứng repository và hồ sơ dự án

Hai ảnh do nhóm cung cấp được lưu nguyên gốc, không chỉnh sửa nội dung:

- `github-repository.png`: nguồn `codex-clipboard-af9e4938-769a-42dc-903d-d0c902d222e5.png`, dùng tại Task 4.1, hiển thị nhánh main, commit 9e35333 và cấu trúc repository.
- `github-docs.png`: nguồn `codex-clipboard-4b89b2d5-f778-4399-8503-399227cb14e1.png`, dùng tại Task 4.2, hiển thị cấu trúc thư mục docs.

Báo cáo chỉ giữ ảnh tổng quan CI và CD; hai vùng phóng báo cáo unit test backend và trạng thái các giai đoạn phát hành đã được bỏ theo yêu cầu nhóm.

## Ảnh UI chụp ngày 20/11/2026

Chụp từ `https://brewlite-frontend.vercel.app/` bằng Chromium headless, phiên khách mới, không tạo đơn hoặc thanh toán. Mở trang chi tiết bằng liên kết trên menu thật. Desktop viewport 1440 x 1050 px; điện thoại mô phỏng 390 x 844 px; device scale factor 2.

- `mvp-menu-desktop.png`, `mvp-detail-desktop.png`: menu và Bạc Xỉu trên desktop.
- `mvp-menu-mobile.png`, `mvp-detail-mobile.png`: cùng luồng trên viewport điện thoại.
- [ui-capture.json](ui-capture.json): URL, viewport, thời gian UTC và HTTP status trang menu.

Ảnh chi tiết desktop lấy vùng `main` của trang để tăng khả năng đọc khi in; ảnh chi tiết điện thoại cuộn đến tiêu đề món để thấy lựa chọn size, số lượng và nút thêm giỏ trong cùng viewport. Nội dung giao diện không bị sửa.

Các ảnh minh họa chức năng trong phạm vi MVP Sprint 1 đang có trên production tại ngày chụp, không phải ảnh lịch sử ở thời điểm kết thúc Sprint 1. Xem Task 4.3.

## MVP Sprint 2 trên môi trường local

Các ảnh `sprint2-*.png` chụp ngày 20/11/2026 từ web local cổng 3140, API local cổng 3141, DB `brewlite_report` trên PostgreSQL 18.6 cổng 55439. Dữ liệu được tạo riêng bằng migration, seed, danh mục nguyên liệu và tồn demo. Tài khoản thử đã xác minh email; không gửi OTP hoặc thực hiện chuyển tiền thật.

Luồng chụp: Bạc Xỉu size M 39.000đ → WELCOME10 giảm 3.900đ → CARD mô phỏng 35.100đ → biên nhận PAID, cộng 3 điểm → chi tiết đơn. ADMIN local sau đó chuyển cùng đơn qua PREPARING, READY, COMPLETED để chụp lịch sử Hoàn tất. Xem [sprint2-capture.json](sprint2-capture.json) để đối chiếu mã đơn và thông tin môi trường. Kênh PayOS thật không được cấu hình trong demo local này.

- `sprint2-cart.png`: vùng giỏ hàng có voucher.
- `sprint2-checkout.png`: vùng phương thức thanh toán và tóm tắt đơn; không sửa nội dung UI.
- `sprint2-receipt.png`: hóa đơn sau thanh toán CARD mô phỏng.
- `sprint2-order-detail.png`: chi tiết đơn ở trạng thái PAID.
- `sprint2-history.png`: cùng đơn đã hoàn tất trong lịch sử.

## Minh chứng integration và E2E local

[testing-integration-20261120.txt](testing-integration-20261120.txt) và [testing-e2e-20261120.txt](testing-e2e-20261120.txt) là stdout/stderr của lượt chạy thành công trên DB `brewlite_test` local riêng, E2E_DATABASE=1, PostgreSQL 18.6, sáu migration. Integration đạt 19/19 ca, E2E qua API đạt 9/9 ca; hai lệnh exit 0.

Hai ảnh terminal do nhóm cung cấp ngày 20/11/2026 được sao chép nguyên gốc, không sửa nội dung và được dùng thay ảnh tổng hợp tại Task 5.2:

| Tệp | Ảnh nguồn | Lượt chạy hiển thị | Kết quả |
| --- | --- | --- | --- |
| `testing-integration-terminal.png` | `codex-clipboard-375b749c-764a-42db-bb8a-6e68e82125e2.png` | 18:42:32, `npm run test:integration` | 2 tệp, 19/19 ca, 3.63 giây, exit 0 |
| `testing-e2e-terminal.png` | `codex-clipboard-e4e67c31-939b-492f-ae92-f5f77c586ef7.png` | Vitest bắt đầu 18:42:51, `npm run test:e2e` | 2 tệp, 9/9 ca, 2.87 giây, exit 0 |

Cả hai ảnh ghi PostgreSQL 18.6 local, DB `brewlite_test`, `E2E_DATABASE=1`. Dòng ERROR trong ảnh integration xuất phát từ ca `đơn cũ đã CANCELLED/RELEASED nhưng PayOS PAID`: ca kiểm tra yêu cầu đối soát và không tự trừ kho; bộ test vẫn đạt. Thông báo `vite-tsconfig-paths` là thông báo từ công cụ chạy test.

Hai log `.txt` ở trên thuộc lượt chạy trước lúc 17:46 cùng ngày, không phải transcript của hai ảnh terminal lúc 18:42. `testing-integration-e2e.png` là ảnh tổng hợp cũ từ hai log này, chỉ giữ để đối chiếu, không còn được đưa vào báo cáo. E2E tự động dùng Supertest và gateway thử nghiệm, tách khỏi thao tác trình duyệt ở bộ ảnh Sprint 2.
