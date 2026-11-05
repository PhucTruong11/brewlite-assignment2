# BrewLite API — Assignment 2

API NestJS nằm trong `apps/api`; Prisma schema, migrations và seed nằm trong `apps/api/prisma`. Web Next.js nằm ở `apps/web`. Cấu trúc toàn repo và trạng thái triển khai xem [README gốc](../../README.md).

## Kiểm tra mã nguồn

Chạy tại `apps/api` với Node 22:

```powershell
npm ci
npx prisma generate
npm run lint
npm test
npm run build
```

CI GitHub dùng cùng thư mục và các lệnh trên. Bộ kiểm thử tích hợp có ghi DB chỉ được chạy với DB test riêng.

## Cấu hình môi trường

`apps/api/.env.example` dành cho local; `apps/api/.env.production.example` liệt kê biến cần đặt trong Render Environment. Không commit `.env` thật, `DATABASE_URL`, JWT, khóa Brevo hoặc SePay.

Trong production, Render dùng repo `PhucTruong11/brewlite-assignment2`, nhánh `main`, Root Directory `apps/api`, Dockerfile Path `./Dockerfile`, Docker Build Context `./`. API kết nối Supabase bằng `DATABASE_URL`; `FRONTEND_URL=https://brewlite-frontend.vercel.app` cho web Vercel. Web gọi `/api` trên cùng domain rồi Next.js proxy tới Render. Chi tiết chuyển nguồn deploy và kiểm tra xem [docs/deployment.md](../../docs/deployment.md).

Migration production chỉ chạy bằng `prisma migrate deploy` sau khi xác định trạng thái schema và backup. Không dùng `prisma db push` hay chạy seed trên DB đang có đơn và tài khoản.

## Compose local tùy chọn

[Docker README](../../docker/README.md) mô tả cách dựng DB, API và web local từ các thư mục `apps/`. Bản Assignment 2 dùng deployment làm môi trường chạy chính; Compose chỉ phục vụ tái tạo và kiểm thử.
