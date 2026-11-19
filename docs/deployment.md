# Triển khai BrewLite Assignment 2

[Sơ đồ triển khai Task 3.2](architecture/deployment/README.md) mô tả các môi trường, kết nối và thành phần mã nguồn tương ứng.

## Môi trường production dùng chung

| Thành phần | Nền tảng | Địa chỉ / cấu hình |
| --- | --- | --- |
| Web Next.js | Vercel | https://brewlite-frontend.vercel.app/ |
| API NestJS | Render | https://brewlite-api-omni.onrender.com/api |
| PostgreSQL | Supabase | Session pooler/TLS; không công khai chuỗi kết nối |

Dashboard đang dùng: [Vercel BrewLite](https://vercel.com/phuc-truong1/brewlite-frontend), [Render API](https://dashboard.render.com/web/srv-dbksjsegekts73f2bsk0), [Supabase BrewLite](https://supabase.com/dashboard/project/aclpnyerlyihsepwkhre). Đây là ba project hiện có; không tạo project cloud khác.

Assignment 2 sử dụng lại dự án Vercel, Render và Supabase của nhóm. Mã nguồn được quản lý trên nhánh `main` của [brewlite-assignment2](https://github.com/PhucTruong11/brewlite-assignment2), với `apps/web` và `apps/api` là các thư mục triển khai.

## Biến môi trường

Vercel, trong project web: `NEXT_PUBLIC_API_URL=/api`, `API_INTERNAL_URL=https://brewlite-api-omni.onrender.com`. Giá trị phải có tại **build time**; đổi biến xong cần redeploy. Browser gọi cùng domain Vercel; Next.js proxy `/api/*` sang Render.

Trong project API trên Render, đặt `NODE_ENV=production`, `FRONTEND_URL=https://brewlite-frontend.vercel.app`, `DATABASE_URL` từ Supabase Session pooler với TLS và `JWT_SECRET` đủ mạnh. Cấu hình mail Brevo HTTPS và đặt `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` trong Render Environment.

Supabase: chỉ API truy cập DB bằng credentials production. Quyền và network của Supabase cần kiểm tra theo cấu hình dự án; frontend không kết nối DB trực tiếp. Cần backup trước migration có thay đổi dữ liệu.

## Lần triển khai mã Assignment 2

1. Kiểm tra CI của nhánh `main` repo Assignment 2 đạt `lint`, `test`, `build`. Ghi lại commit SHA và deployment cũ để có thể quay lại.
2. Trên **project Vercel hiện có**, đổi Git repository sang `PhucTruong11/brewlite-assignment2`, branch `main`, Root Directory `apps/web`, preset Next.js. Giữ các biến web production ở trên và kiểm tra lại trước khi deploy.
3. Trên **service Render hiện có**, đổi Git repository sang cùng repo/branch, Root Directory `apps/api`, Dockerfile Path `./Dockerfile` và Docker Build Context `./` (các đường dẫn tính từ Root Directory). Giữ nguyên URL, environment và secret đang có. Kiểm tra lại Start Command/health check theo cấu hình service. Render có thể tự khởi chạy deploy ngay khi đổi source.
4. Kiểm tra schema Supabase và danh sách migration trước khi rollout. Nếu có migration mới, backup DB rồi chạy `prisma migrate deploy` từ `apps/api` theo quy trình triển khai của Render. Không dùng `db push`, không seed lại DB đang có dữ liệu.
5. Deploy API trước và kiểm tra health cùng `GET /api/products`. Đăng ký `https://<api-host>/api/payments/payos-webhook` trên dashboard PayOS. Sau khi deploy web, kiểm tra HTTPS, đăng nhập, tạo đơn và xác nhận thanh toán qua webhook bằng kênh PayOS đã cấu hình.
6. Mỗi lần merge hoặc push vào `main`, workflow `.github/workflows/cd.yml` tự chạy CI trên commit vừa nhận. Khi cả ba job CI thành công, workflow build/push image có tag SHA lên GHCR, xác minh target Render/Vercel, chạy migration, triển khai đúng commit đó lên Render, triển khai web lên Vercel và smoke test. CI thất bại thì các job build image và deploy được bỏ qua. Workflow cũng hỗ trợ tag `v*` và `Run workflow` để phát hành thủ công. Lưu release notes, bằng chứng CI/CD và kết quả smoke test.

## Thiết lập GitHub Actions trước release

Trong repo Assignment 2, tạo environment `production` và lưu **secrets**: `RENDER_API_KEY`, `RENDER_SERVICE_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PRODUCTION_DATABASE_URL`. `RENDER_SERVICE_ID` của project này là `srv-dbksjsegekts73f2bsk0`; các token, ID còn lại và chuỗi kết nối lấy từ tài khoản của nhóm, không ghi giá trị vào tài liệu hoặc mã nguồn. Cấu hình GitHub branch protection trên `main` để bắt buộc ba job CI `Build & Check Backend`, `Build & Check Frontend`, `API integration and order E2E` thành công trước khi merge.

Render phải trỏ đúng GitHub repo `PhucTruong11/brewlite-assignment2`, branch `main`, Root Directory `apps/api`, Dockerfile `./Dockerfile`, build context `./`. Trong Settings → Build & Deploy, đặt Auto-Deploy = Off để workflow release điều khiển production sau khi CI pass. Workflow kiểm tra repo/branch/root trước khi gọi Render API. Trên Vercel, giữ project hiện có và biến `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` để CLI phát hành vào đúng project. File `apps/web/vercel.json` tắt deploy trực tiếp từ Git cho nhánh `main`; workflow dùng Vercel CLI để phát hành sau bước CI và migration. Web vẫn cần biến `NEXT_PUBLIC_API_URL=/api`, `API_INTERNAL_URL=https://brewlite-api-omni.onrender.com` trong Vercel Production. Nếu environment `production` có Required reviewers, job deploy sẽ chờ duyệt; bỏ yêu cầu này khi nhóm muốn quy trình tự động hoàn toàn.

**Trước lần đầu chạy CD:** kiểm tra bảng `_prisma_migrations` trên Supabase, chụp backup và đối chiếu migration `20261029000100_prune_legacy_catalog` vì migration này xóa sản phẩm/topping cũ. Nếu DB production trước đây chỉ dùng `prisma db push`, phải baseline migration đúng cách; không bấm chạy CD để thử. Sau khi đã xác minh migration và backup, đặt GitHub Environment **variable** `PRODUCTION_MIGRATION_BASELINE_OK=true`; đây là cổng chặn trước bước đụng DB. Sau đó có thể tạo tag `v2.0.0` hoặc chạy workflow thủ công. Workflow dừng nếu thiếu secret, target Vercel/Render sai hoặc chưa xác nhận baseline. Không chạy seed trên production.

CI dùng PostgreSQL 16 tạm, chạy `prisma migrate deploy`, `npm run test:integration` và `npm run test:e2e` với DB `brewlite_test`. Các bài test tạo rồi dọn dữ liệu fixture, dùng CARD mô phỏng và webhook PayOS có chữ ký với link giả lập. CD build hai Docker image có tag commit SHA và lưu trên GHCR. Render và Vercel xây dựng từ cùng source commit. Sau deploy, smoke test gọi API `/api/health`, `/api/products`, web HTTPS và proxy web `/api/health`.

## Đối soát PayOS khi khách đã chuyển tiền nhưng checkout chưa hoàn tất

Ba biến `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` cho phép API gọi PayOS; chủ kênh vẫn cần cấu hình Webhook URL của đúng kênh tại `my.payos.vn` thành `https://brewlite-api-omni.onrender.com/api/payments/payos-webhook`. Return URL đưa trình duyệt về web, không thay thế webhook xác nhận tiền. Xác minh webhook trên dashboard PayOS và kiểm tra Render có nhận request thành công, không đưa key vào URL hay frontend. Tài liệu gốc: https://payos.vn/docs/api/.

API đối soát link PayOS khi checkout polling (tối đa một lần mỗi 5 giây cho cùng đơn), và luôn đối soát trước khi hủy do hết hạn. PAID, số tiền link và số tiền đã nhận phải khớp đơn mới hoàn tất kho/điểm trong transaction có khóa đơn. Nếu cổng không phản hồi, giữ nguyên đơn và reservation; giao diện báo đang đối soát, chưa cho gia hạn tạo đơn khác. Chỉ hủy/trả kho khi xác nhận link CANCELLED/EXPIRED và chưa nhận tiền.

Nếu đơn từ bản cũ đã CANCELLED/RELEASED nhưng PayOS có tiền, hiển thị yêu cầu đối soát, không tự phục hồi đơn hoặc trừ kho đã cấp cho đơn khác. Đối chiếu mã đơn, link, số tiền, thời điểm và giao dịch trên PayOS/Supabase trước khi xử lý thủ công. Không đánh dấu PAID chỉ dựa trên return URL, ảnh chuyển khoản hoặc đổi status trực tiếp.

## Rollback ứng dụng

Workflow thử rollback về deployment Vercel trước và commit Render trước nếu rollout/smoke test thất bại. Render rollback cần commit cũ vẫn còn trong repo đang kết nối; lần đầu chuyển repo có thể phải thao tác thủ công trong dashboard. Vercel Hobby chỉ cho rollback về deployment production ngay trước. Sau khi rollback, kiểm tra lại URL web/API và trạng thái rollback trên dashboard. **Rollback ứng dụng không tự rollback schema hoặc dữ liệu PostgreSQL**; migration phải tương thích ngược hoặc khôi phục DB từ backup theo quy trình riêng.

## Trạng thái so với Assignment 2

`docker-compose.yml` được giữ cho yêu cầu tái tạo stack local của đề nhưng không dùng làm môi trường demo chính. CI, bài E2E ở mức API và CD đã có trong mã nguồn; CD vẫn cần secrets, dự án cloud trỏ đúng repo, kiểm tra migration production và một release run thành công để có bằng chứng. Bài E2E hiện xác nhận luồng qua API; nếu giảng viên yêu cầu thao tác trình duyệt thật, nhóm cần bổ sung browser E2E. Các tài liệu Sprint, release notes và video demo cũng chưa nằm trong pipeline.

## Chống spam đăng ký và giới hạn tần suất

API giới hạn tần suất theo IP bằng `@nestjs/throttler` (bộ đếm nằm trong bộ nhớ của một instance API, phù hợp cấu hình Render hiện tại). Vượt giới hạn trả HTTP 429 kèm `Retry-After`; riêng các endpoint dưới đây còn khóa IP vi phạm trong `blockDuration`.

| Endpoint | Giới hạn mỗi IP | Khóa IP khi vượt |
| --- | --- | --- |
| `POST /api/auth/register` | 5 lần / 1 giờ | 1 giờ |
| `POST /api/auth/resend-verification`, `POST /api/auth/forgot-password` | 5 lần / 1 giờ | 1 giờ |
| `POST /api/auth/verify-email`, `POST /api/auth/reset-password` | 10 lần / 10 phút | 10 phút |
| `POST /api/auth/login` | 10 lần / 1 phút | 5 phút |
| Các endpoint còn lại | 300 lần / 1 phút | không |

Webhook PayOS không bị giới hạn theo IP vì đã kiểm tra chữ ký. Khi `NODE_ENV=test` (CI) bộ giới hạn tắt để test gọi API liên tục. Ngoài ra `POST /api/auth/register` từ chối bằng 429 khi toàn hệ thống đã tạo từ `MAX_UNVERIFIED_SIGNUPS_PER_HOUR` tài khoản chưa xác minh trong 1 giờ gần nhất, để bot đổi IP vẫn không làm cạn hạn mức gửi email OTP.

Biến môi trường tùy chọn trên Render:

- `TRUST_PROXY_HOPS`: số proxy tin cậy phía trước API. Mặc định `2` ở production (Vercel → Render) và `0` ở môi trường khác. Sau khi deploy, kiểm tra log `RateLimit` có dòng `ip=...` là IP khách thật. Nếu thấy IP của Vercel/Render thì tăng giá trị; nếu `ip` trùng một giá trị do client tự gửi trong `xff` thì giảm giá trị.
- `BLOCKED_IPS`: danh sách IP bị chặn hẳn (phân tách bằng dấu phẩy), lấy từ log `RateLimit`. Cần deploy lại để có hiệu lực.
- `MAX_UNVERIFIED_SIGNUPS_PER_HOUR`: mặc định `30`; đặt `0` để tắt trần này.

Ghi chú vận hành: nếu có thêm instance API, bộ đếm theo IP không dùng chung giữa các instance. Khi đó cần Redis làm nơi lưu hoặc đặt giới hạn ở tầng CDN/WAF.