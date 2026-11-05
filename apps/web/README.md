# BrewLite Web

Ứng dụng Next.js cho khách mua đồ uống và trang quản trị. Bản Assignment 2 dùng URL production trong [README gốc](../../README.md) và [deployment guide](../../docs/deployment.md). Các lệnh local phía dưới là ghi chép từ Assignment 1 để đáp ứng khả năng tái tạo; đường dẫn thư mục hiện tại là `apps/web`.

## Luồng hiện tại

Khách chọn món và cấu hình → giỏ kiểm tra công thức/nguyên liệu qua API → bấm “Tiến hành Thanh toán” để tạo đơn, giữ nguyên liệu 2 phút → trang checkout hiển thị QR và đồng hồ → xác nhận kết quả thanh toán → hóa đơn và theo dõi đơn. Trang admin Nguyên liệu/Công thức dùng API backend.

Các file chính: `src/stores/cart.store.ts` giữ giỏ, `src/components/cart/CartContent.tsx` tạo đơn, `src/app/checkout/page.tsx` xử lý xác nhận trả/gia hạn, `src/app/admin/ingredients/page.tsx` và `src/app/admin/recipes/page.tsx` hiển thị dữ liệu quản trị. Chi tiết nằm ở [PROJECT_FLOW.md](../PROJECT_FLOW.md).

## Kiểm tra mã nguồn

Chạy trong thư mục `frontend` với Node 22 và dependency từ `npm ci`:

```powershell
npm run lint
npm run build
npm test
```

Các lệnh trên là bước CI. `npm run dev` chỉ dùng khi phát triển frontend trực tiếp trên máy; dừng container `web` trước để tránh trùng cổng 3000. Khi chạy Compose, web gọi `/api` qua proxy Next.js đến container API; không cần chạy Node riêng.
