# BrewLite — Assignment 2

Bản này tách riêng khỏi `../brewlite` (Assignment 1). Mã nguồn được sao chép từ trạng thái làm việc của Assignment 1 ngày 05/11/2026, rồi sắp lại theo cấu trúc đề Assignment 2. Thư mục `../brewlite` không bị sửa.

## Cấu trúc

```text
brewlite-assignment2/
├── apps/
│   ├── web/              # Next.js: khách hàng, checkout, admin
│   └── api/              # NestJS: API, Prisma schema/migrations/seed
├── docs/
│   ├── requirements/     # Đề bài, hồ sơ yêu cầu, use-case
│   ├── diagrams/         # Nguồn và bản xuất UML
│   ├── architecture/     # Kiến trúc và ADR
│   ├── traceability-matrix.md
│   └── deployment.md
├── tests/                # Thunder/Postman collections
├── .github/workflows/    # CI; mẫu CD chưa kích hoạt
├── docker/               # Compose local theo yêu cầu đề
├── docker-compose.yml
├── .env.example
└── README.md
```

Đề gốc: [Assignment 2](docs/requirements/assignment2-brief.pdf). Bản này **dùng môi trường deploy để chạy và demo**; Compose local được giữ để đáp ứng checklist của đề nhưng không được khởi động khi chuẩn bị thư mục này.

## Production hiện có

- Web HTTPS: https://brewlite-frontend.vercel.app/
- API HTTPS: https://brewlite-api-omni.onrender.com/api
- DB: Supabase PostgreSQL; credentials chỉ ở Render Environment.

Các URL trên đang thuộc cấu hình deploy hiện có. **Chưa xác nhận hosting đã build từ thư mục Assignment 2 này.** Vercel/Render phải được trỏ sang repository chứa thư mục này, với Root Directory lần lượt `apps/web` và `apps/api`, trước khi coi deployment là bản Assignment 2. Xem [hướng dẫn triển khai và rollback](docs/deployment.md).

Web production cần `NEXT_PUBLIC_API_URL=/api` và `API_INTERNAL_URL=https://brewlite-api-omni.onrender.com` ở Vercel. API cần `FRONTEND_URL=https://brewlite-frontend.vercel.app`, `DATABASE_URL` Supabase, `JWT_SECRET` và secret mail/thanh toán ở Render. Không commit `.env` thật. Các file `.env.example` chỉ mô tả tên và định dạng biến.

## Kiểm thử và build từ mã nguồn

Các lệnh sau chỉ kiểm tra mã, **không khởi động ứng dụng local và không ghi DB production**:

```powershell
cd apps/api
npm ci
npx prisma generate
npm run lint
npm test
npm run build

cd ../web
npm ci
npm run lint
npm test
npm run build
```

Test API thủ công trong `tests/` chỉ gửi đến URL được chọn trong environment của Thunder/Postman. Đừng để mặc định `localhost` khi kiểm tra production; các request `POST /api/orders` và thanh toán có thể ghi **DB production**. Dùng tài khoản và dữ liệu demo riêng, tránh chạy ca thay đổi stock trên DB thật.

## Trạng thái Assignment 2

- **Đã sắp cấu trúc:** `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows`, Dockerfile/Compose và Prisma migration được sao chép; CI đã cập nhật đường dẫn mới.
- **Cần làm Task 1–3:** SRS, use-case, ba loại sơ đồ UML, deployment diagram đúng nền tảng thật, ADR được nhóm duyệt và ma trận truy vết hoàn chỉnh. Xem README trong từng thư mục `docs/`.
- **Cần chứng minh Task 4–5:** CI chạy trên PR và branch protection; integration/E2E với DB test riêng; health endpoint kiểm tra DB; CD thực sự build/tag/push image, migration/deploy/smoke/rollback; release notes, Sprint Review/Retrospective và video demo. `.github/workflows/cd.yml.example` hiện **chưa được kích hoạt**.

## Git và bàn giao

Thư mục này là bản sao nguồn **chưa tự kết nối với GitHub**. Tạo repository/branch cho Assignment 2 rồi push, review qua PR và bật CI. Không đổi Root Directory của các dịch vụ đang phục vụ Assignment 1 cho tới khi nhóm xác nhận cách chuyển; có thể tạo project deploy riêng cho Assignment 2 để hai bản độc lập. Lưu URL, release/tag và bằng chứng pipeline trong `docs/deployment.md`.
