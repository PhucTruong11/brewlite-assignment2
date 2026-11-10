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
├── .github/workflows/    # CI và phát hành production theo tag
├── docker/               # Compose local theo yêu cầu đề
├── docker-compose.yml
├── .env.example
└── README.md
```

Đề gốc: [Assignment 2](docs/requirements/assignment2-brief.pdf). Bản này **dùng môi trường deploy để chạy và demo**; Compose local được giữ để đáp ứng checklist của đề nhưng không được khởi động khi chuẩn bị thư mục này.

## Production cho Assignment 2

- Web HTTPS: https://brewlite-frontend.vercel.app/
- API HTTPS: https://brewlite-api-omni.onrender.com/api
- DB: Supabase PostgreSQL; credentials chỉ ở Render Environment.

Nhóm dùng lại **chính các project Vercel/Render và DB Supabase này** cho Assignment 2, giữ nguyên URL. Repo Assignment 2 là [PhucTruong11/brewlite-assignment2](https://github.com/PhucTruong11/brewlite-assignment2). Bản `../brewlite` tiếp tục chạy local; sau khi đổi nguồn deploy, các URL trên sẽ phục vụ mã Assignment 2. **Hiện chưa xác nhận hosting đã đổi nguồn và deploy bản này.** Xem [hướng dẫn chuyển nguồn và rollback](docs/deployment.md).

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

CI chạy tự động cho pull request và `main`: lint, unit test, build của hai app, test tích hợp API và E2E API với PostgreSQL 16 tạm. E2E đi qua menu → đăng nhập → tạo đơn → xác nhận trạng thái `PAID` qua CARD mô phỏng hoặc webhook PayOS ký bằng khóa test; test tích hợp kiểm tra thêm dữ liệu sai, quyền truy cập, tranh chấp nguyên liệu, thanh toán thất bại và thử lại. Ma trận ca kiểm thử nằm trong [tests/README.md](tests/README.md). Chạy riêng trên máy chỉ khi đã tạo DB **`brewlite_test`**:

```powershell
cd apps/api
$env:DATABASE_URL = 'postgresql://<user>:<password>@127.0.0.1:<port>/brewlite_test'
$env:E2E_DATABASE = '1'
$env:JWT_SECRET = 'local-test-only'
$env:NODE_ENV = 'test'
npx prisma migrate deploy
npm run test:integration
npm run test:e2e
```

Bài test chỉ chạy nếu tên DB là `brewlite_test` và host là `localhost` hoặc `127.0.0.1`; tuyệt đối không đặt `E2E_DATABASE=1` với DB thật. CI tạo DB tạm tự động, nên nhóm có thể xem kết quả trên GitHub Actions mà không chạy local. Đường dẫn lệnh này chỉ dành cho kiểm thử, không phải cách chạy bản Assignment 2 để demo.

Test API thủ công trong `tests/` chỉ gửi đến URL được chọn trong environment của Thunder/Postman. Đừng để mặc định `localhost` khi kiểm tra production; các request `POST /api/orders` và thanh toán có thể ghi **DB production**. Dùng tài khoản và dữ liệu demo riêng, tránh chạy ca thay đổi stock trên DB thật.

## Trạng thái Assignment 2

- **Đã sắp cấu trúc:** `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows`, Dockerfile/Compose và Prisma migration được sao chép; CI đã cập nhật đường dẫn mới.
- **Task 1:** Bối cảnh/phạm vi và SRS rút gọn đã được viết tại `docs/requirements/`, có bản LaTeX cho Task 1.1–1.2. Task 1.3 còn cần hoàn thiện đặc tả use-case trọng tâm; các sơ đồ Task 2, deployment diagram Task 3, ADR được nhóm duyệt và ma trận truy vết vẫn cần hoàn thiện.
- **Task 4–5:** Workflow CI và CD, E2E API với DB test riêng và `GET /api/health` đã có trong mã nguồn. CD chỉ chạy khi tạo tag `v*` hoặc gọi thủ công; cần cấu hình secrets, chuyển source Render sang repo mới, kiểm tra migration production và ghi bằng chứng run thành công. Branch protection, release notes, Sprint Review/Retrospective và video demo vẫn cần nhóm thực hiện trên GitHub/tài liệu.

## Git và bàn giao

Thư mục này đã là Git repo riêng và đã push lên `PhucTruong11/brewlite-assignment2`, nhánh `main`. Nhóm đã chọn chuyển **các project deploy hiện có** sang repo này; cần kiểm tra CI, đổi đường dẫn build, deploy và lưu bằng chứng trong `docs/deployment.md`. Việc chuyển nguồn deploy không sửa thư mục local `../brewlite`.
