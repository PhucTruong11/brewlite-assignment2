# Triển khai BrewLite Assignment 2

## Môi trường production đang dùng

| Thành phần | Nền tảng | Địa chỉ / cấu hình |
| --- | --- | --- |
| Web Next.js | Vercel | https://brewlite-frontend.vercel.app/ |
| API NestJS | Render | https://brewlite-api-omni.onrender.com/api |
| PostgreSQL | Supabase | Session pooler/TLS; không công khai chuỗi kết nối |

**Chưa xác nhận các URL trên đã được liên kết với mã trong repo Assignment 2 này.** Repo nguồn Assignment 1 đang dùng đường dẫn `frontend/`, `backend/`; repo này dùng `apps/web`, `apps/api`. Sau khi đưa Assignment 2 lên Git, phải chỉnh Root Directory của Vercel thành `apps/web`, Root Directory/Dockerfile của Render thành `apps/api`, rồi deploy lại. Không sửa cấu hình đang phục vụ bản Assignment 1 trước khi nhóm quyết định cách chuyển môi trường.

## Biến môi trường

Vercel, trong project web: `NEXT_PUBLIC_API_URL=/api`, `API_INTERNAL_URL=https://brewlite-api-omni.onrender.com`. Giá trị phải có tại **build time**; đổi biến xong cần redeploy. Browser gọi cùng domain Vercel; Next.js proxy `/api/*` sang Render.

Render, trong project API: `NODE_ENV=production`, `FRONTEND_URL=https://brewlite-frontend.vercel.app`, `DATABASE_URL` lấy từ Supabase Session pooler với TLS, `JWT_SECRET` đủ mạnh; cấu hình mail (Brevo HTTPS) và SePay theo dịch vụ đã đăng ký. Chỉ lưu các giá trị thật trong Environment/Secret của nhà cung cấp. Không đưa `DATABASE_URL`, JWT, Brevo hoặc SePay key vào repo, Docker build args hay client.

Supabase: chỉ API truy cập DB bằng credentials production. Quyền và network của Supabase cần kiểm tra theo cấu hình dự án; frontend không kết nối DB trực tiếp. Cần backup trước migration có thay đổi dữ liệu.

## Lần triển khai mã Assignment 2

1. Đưa thư mục này lên repository/branch mà Vercel và Render có thể đọc. Kiểm tra GitHub Actions CI đạt `lint`, `test`, `build` trên PR.
2. Chỉnh đường dẫn của Vercel/Render như trên. Dùng env production đã cấu hình tại hosting, không copy `.env` local.
3. Chạy `prisma migrate deploy` từ `apps/api` với `DATABASE_URL` production theo một bước migration được kiểm soát, trước khi chuyển traffic sang API mới. Không dùng `db push`, không seed lại DB đang có dữ liệu. Cách chạy tại Render/Supabase phải được nhóm chốt và kiểm thử.
4. Deploy API và web; smoke test HTTPS web, `GET /api/products`, đăng nhập, giỏ, tạo đơn và thanh toán trong môi trường demo thích hợp. Kiểm tra webhook SePay trỏ đến **API HTTPS** của bản đang phục vụ đơn đó; callback của bản Assignment 1 không thể cập nhật DB khác.
5. Gắn release tag theo commit SHA, lưu release notes, bằng chứng CI/CD và kết quả smoke test.

## Rollback

Giữ lại commit/deployment web/API trước đó trên Vercel và Render. Khi smoke test lỗi, dừng rollout, chọn lại deployment ứng dụng trước và kiểm tra web/API. **Rollback code không tự rollback schema hoặc dữ liệu PostgreSQL**; migration phải tương thích ngược hoặc có kế hoạch khôi phục DB/backup riêng. Việc rollback chưa được tự động hóa trong workflow hiện tại.

## Trạng thái so với Assignment 2

`docker-compose.yml` được giữ cho yêu cầu tái tạo stack local của đề nhưng không dùng làm môi trường chạy chính của bản Assignment 2. Workflow CI đã được chuyển đường dẫn sang `apps/`. `cd.yml.example` chỉ là bản mẫu, **chưa phải CD hoạt động**; còn cần script build/test image, registry, migration/deploy và rollback thật. Health endpoint kiểm tra DB, browser E2E và minh chứng pipeline production cũng cần hoàn thiện trước khi nộp.
