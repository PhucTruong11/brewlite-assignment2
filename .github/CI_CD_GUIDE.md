# CI/CD BrewLite Assignment 2

## CI trên pull request và `main`

Workflow [ci.yml](workflows/ci.yml) chạy `npm ci → lint → unit test → build` cho `apps/api` và `apps/web`. Job thứ ba dựng PostgreSQL 16 tạm, áp dụng Prisma migrations và chạy [API E2E](../apps/api/test/app.e2e-spec.ts). Bài E2E dùng DB tên `brewlite_test`, không gọi Supabase production hoặc cổng thanh toán thật. Nó kiểm tra menu, đăng nhập, đơn thiếu nguyên liệu, đơn PENDING, thanh toán CARD, idempotency, lịch sử, hết hạn và nhả kho.

Trong GitHub Settings → Rules → Rulesets hoặc Branch protection của `main`, bật yêu cầu pull request và yêu cầu ba check thành công: `Build & Check Backend`, `Build & Check Frontend`, `API integration and order E2E`. Lưu ảnh một PR lỗi bị chặn, sau khi sửa thì CI xanh để làm minh chứng Assignment 2.

## Release production

Workflow [cd.yml](workflows/cd.yml) chỉ chạy khi push tag `v*` hoặc bấm Run workflow. Nó gọi lại CI trên cùng commit, build hai Docker image gắn tag SHA và push GHCR, chạy `prisma migrate deploy` trên Supabase, gọi Render API deploy đúng SHA, triển khai web lên Vercel và smoke test URL HTTPS. Nếu rollout thất bại sau khi đã đổi ứng dụng, workflow thử rollback Render/Vercel; schema DB không được tự đảo ngược.

Tạo GitHub Environment tên `production` và thêm sáu secret: `RENDER_API_KEY`, `RENDER_SERVICE_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PRODUCTION_DATABASE_URL`. Không đưa giá trị thật vào repo. `RENDER_SERVICE_ID` ứng với service đã chọn là `srv-dbksjsegekts73f2bsk0`. Các URL production đã đặt trong workflow: web `https://brewlite-frontend.vercel.app/`, API `https://brewlite-api-omni.onrender.com`.

Render phải trỏ repo `PhucTruong11/brewlite-assignment2`, nhánh `main`, Root Directory `apps/api`; workflow từ chối deploy nếu khác. Vercel dùng project hiện có qua `VERCEL_ORG_ID` và `VERCEL_PROJECT_ID`, không cần tạo project mới. Tắt auto deploy production của hai nền tảng nếu muốn chỉ release theo tag sau CI. Chi tiết migration lần đầu, backup, cấu hình hosting, smoke test và rollback: [docs/deployment.md](../docs/deployment.md).

Trước khi tạo tag đầu tiên, kiểm tra `_prisma_migrations` trên Supabase và backup. Migration dọn danh mục cũ có lệnh `DELETE`, nên không chạy thử CD vào DB thật. Nếu production trước đây dùng `prisma db push`, cần baseline migration đúng cách trước khi bật workflow. Sau khi xác minh baseline và backup, đặt Environment variable `PRODUCTION_MIGRATION_BASELINE_OK=true`. CD kiểm tra service Render và project Vercel trỏ đúng repo, branch, root directory trước khi chạm DB. Chỉ khi CI xanh và migration đã được kiểm tra mới tạo tag release.

## Bằng chứng cần lưu

1. Run CI xanh và PR đỏ bị chặn bởi required checks.
2. Kết quả E2E: menu → orderId → PAID, ca thiếu nguyên liệu và timeout.
3. Run CD xanh: SHA image trên GHCR, migration, Render/Vercel deploy và HTTP 200 từ smoke test.
4. Release notes, URL HTTPS, thao tác rollback đã thử, Sprint Review/Retrospective và video demo.

Workflow hiện đã có mã nhưng **chưa phải bằng chứng CD thành công** cho đến khi secrets, hosting và migration production được cấu hình và một release run xanh.
