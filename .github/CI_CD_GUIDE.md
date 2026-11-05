# Mẫu CI và CD cho BrewLite

> Ghi chú Assignment 2: mã nguồn đã chuyển sang `apps/web` và `apps/api`. Workflow `ci.yml` đang hoạt động đã dùng đường dẫn mới. `cd.yml.example` vẫn là bản mẫu, chưa có script triển khai thật; xem `../docs/deployment.md` trước khi bật. Các đoạn mô tả `frontend/` và `backend/` bên dưới là ghi chép từ Assignment 1.

Hai file sau là mẫu để nhóm bổ sung, chưa được GitHub Actions kích hoạt:

- [ci.yml.example](workflows/ci.yml.example): kiểm tra chất lượng cho frontend và backend.
- [cd.yml.example](workflows/cd.yml.example): gọi lại CI, build/test image, push GHCR, migration, deploy, smoke test và rollback ứng dụng khi rollout thất bại.

Workflow [ci.yml](workflows/ci.yml) hiện tại vẫn là cấu hình đang hoạt động. Các mẫu dùng đường dẫn `frontend` và `backend` theo repo hiện tại. Khi chuyển sang `apps/web` và `apps/api`, sửa đường dẫn trong cả hai mẫu, Docker build context, script và Compose cùng lúc.

## 1. Bổ sung và bật CI

Luồng của mỗi ứng dụng:

~~~text
Kiểm tra npm scripts → npm ci → Generate Prisma (API) → Lint → Unit Test → Build
~~~

Mẫu chạy khi có PR vào `main`, push vào `main`, chạy thủ công hoặc được CD gọi qua `workflow_call`. Hai ứng dụng chạy thành hai job song song. Node.js 22 được chọn cho mẫu; đồng bộ phiên bản này với máy phát triển và Dockerfile khi nhóm chốt runtime.

Trước khi bật:

1. Workflow đang chạy đã dùng `npm ci`, Prisma generate, `lint`, `build`, `test` cho backend; frontend dùng `npm ci`, `lint`, `build`, `test`.
2. Frontend cần thêm test runner, các test nghiệp vụ và script `test` vào `frontend/package.json`. Ví dụ nếu chọn Vitest, script là `"test": "vitest run"`; phải cài và cấu hình runner trước. Ưu tiên test menu theo Task 4, sau đó cart/voucher và các phần đang sửa.
3. `npm test` phải chạy một lần rồi thoát, không watch, trả mã lỗi khi test thất bại. Mẫu không bỏ qua script còn thiếu hoặc trường hợp chưa có test.
4. Giữ workflow hiện tại khi chỉ cần quality gate PR. `ci.yml.example` là mẫu mở rộng cho push/workflow_call, chưa cần thay file đang chạy. CI unit/build không cần Compose hay database đang chạy; test truy cập DB thật thuộc lớp integration riêng.
5. Sau khi workflow chạy, chọn hai check `Check backend` và `Check frontend` trong ruleset/branch protection của `main`. Chọn tên thực tế GitHub hiển thị nếu có thêm tiền tố workflow.
6. Lưu minh chứng một lần chạy thành công và một PR có lỗi bị CI phát hiện/chặn merge. Sửa lỗi rồi chạy lại trước khi merge.

Các biến DB/JWT trong mẫu CI là giá trị thử cho unit/build, không dùng cho production. CI không cấp PostgreSQL service. Nếu một test cần DB thật, tách sang integration hoặc chủ động cấu hình service/fixture riêng.

Frontend build hiện tải Google Font; runner cần truy cập được nguồn font. Lỗi build phải được xử lý và ghi nhận đúng, không thay build bằng kiểm tra TypeScript để coi như đã đạt.

## 2. Phần CD đã chuẩn bị trong mẫu

~~~text
Push tag v* hoặc chạy thủ công
  → Chạy lại CI trên đúng commit
  → Kiểm tra file và cấu hình còn thiếu
  → Build image API và web cho Linux amd64
  → Integration và browser E2E trên chính các image vừa build
  → Push hai image đã qua test lên GHCR
  → Migration tại môi trường đích
  → Deploy đúng hai image đó
  → Smoke test HTTPS web và API health
  → Rollback ứng dụng nếu rollout/smoke thất bại; workflow vẫn báo lỗi
~~~

GHCR là registry minh họa của mẫu, chưa phải quyết định nền tảng hosting. Image có dạng `ghcr.io/phuctruong11/swe/web:<commit-sha>` và `ghcr.io/phuctruong11/swe/api:<commit-sha>`. Không ghi đè tag SHA đã phát hành. Mẫu build một kiến trúc và push image đã load/test, không build lại trong bước deploy.

CD dùng `needs` để chặn các bước sau khi bước trước thất bại, có hàng đợi để tránh hai release cùng sửa production, và dùng GitHub Environment `production`. Nhóm có thể cấu hình người duyệt release ở environment này theo cách vận hành đã chọn.

Hai mẫu phải được đưa vào cùng một phiên bản code trước khi chạy CD: `cd.yml` gọi `ci.yml`, và `ci.yml` bắt buộc có `workflow_call`. Chạy CD thủ công sau khi workflow đã có trên nhánh mặc định. Tag `v*` phải trỏ tới commit đã review mà nhóm muốn phát hành.

## 3. Những phần cần tự bổ sung trước khi bật CD

| Hạng mục | Cần hoàn thành |
| --- | --- |
| CI | Workflow PR hiện có đã chạy lint/test/build cho hai ứng dụng; còn cần kiểm tra run trên GitHub và required checks |
| Docker | Dockerfile và `.dockerignore` hiện có; Compose web/API/DB dùng ghép `docker-compose.dev.yml` và `docker-compose.app.yml` |
| Cấu hình web | Proxy `/api` qua Next.js đã dùng trong Compose; kiểm tra lại URL và HTTPS khi chọn nơi triển khai thật |
| Migration | Commit `backend/prisma/migrations/*/migration.sql`; DB thành viên có dữ liệu cũ cần baseline một lần rồi `migrate deploy` |
| Health | Endpoint API kiểm tra được trạng thái sẵn sàng và kết nối DB; không dùng “Hello World” làm minh chứng health DB |
| Test container | Script chạy integration order/payment và ít nhất một browser E2E từ menu đến xác nhận đơn, dùng DB test riêng |
| Hosting | Chọn nền tảng, tạo ứng dụng/DB, HTTPS, secret runtime và quyền pull image GHCR |
| Vận hành | Viết script migration/deploy/rollback theo nền tảng; lưu phiên bản trước; kiểm chứng khôi phục |

Các script dưới đây là điểm nối cần triển khai, hiện chưa được tạo. Mẫu kiểm tra chúng tồn tại trước khi build/push; kiểm tra tồn tại không chứng minh nội dung script đã đúng.

| Script | Đầu vào và nhiệm vụ |
| --- | --- |
| `scripts/ci/test-containers.sh` | Nhận `WEB_IMAGE`, `API_IMAGE`, `RELEASE_SHA`. Khởi động đúng image bằng Compose, không rebuild/pull bản khác; đợi health, migration/fixture trên DB test riêng, chạy integration và browser E2E. Dọn container/volume test bằng `trap` kể cả khi lỗi; giữ nguyên mã lỗi của test. Cài dependency/browser cần thiết cho runner trong script này. |
| `scripts/cd/migrate.sh` | Nhận `API_IMAGE`, `DEPLOY_TARGET`, `DEPLOY_TOKEN`. Chạy `prisma migrate deploy` từ bản API mới tại môi trường đích có kết nối DB private. Database URL lấy từ secret của nền tảng. Backup và kiểm tra tính tương thích trước khi phát hành; không chạy seed hoặc `db push` lên production. |
| `scripts/cd/deploy.sh` | Nhận `WEB_IMAGE`, `API_IMAGE`, `RELEASE_SHA`, `DEPLOY_TARGET`, `DEPLOY_TOKEN`. Lưu cặp image đang chạy ở nơi bền vững, gắn snapshot với `RELEASE_SHA` của lần deploy này trước khi thay đổi; triển khai cặp image mới và đợi rollout hoàn tất. Không rebuild từ source tại hosting. |
| `scripts/cd/rollback.sh` | Nhận `RELEASE_SHA`, `DEPLOY_TARGET`, `DEPLOY_TOKEN`; đọc cặp image trước đó từ snapshot đúng lần deploy này, triển khai lại và kiểm tra health. Báo lỗi rõ nếu chưa có snapshot/phiên bản trước hoặc rollback thất bại. Khôi phục schema/dữ liệu DB có quy trình riêng. |

Viết script với `set -euo pipefail`, kiểm tra kết quả lệnh và trả mã khác 0 khi thất bại. Bổ sung cài đặt CLI/xác thực tương ứng nền tảng trong script hoặc workflow. Không dùng script rỗng, chỉ `echo`, `exit 0`, `--if-present` hay `continue-on-error` để vượt quality gate.

Image web đang chứa API URL cho production. Khi chạy E2E với DB test, cấu hình proxy/routing để request API của trình duyệt đi đến API test; không cho test gọi API production. Có thể chọn web dùng cùng origin `/api` và reverse proxy theo môi trường, nhưng cần xử lý đúng cấu hình Next.js hiện tại trước. Script test chỉ coi là hoàn thành khi chứng minh request đi vào stack test.

Nếu migration thất bại, deploy dừng. Nếu deploy hoặc smoke test thất bại, workflow gọi rollback ứng dụng; bước thất bại trước vẫn khiến cả run báo lỗi. Cơ chế này yêu cầu migration tương thích với phiên bản ứng dụng trước. Lần deploy đầu chưa có bản cũ thì cần xử lý phục hồi lần đầu trong script và tài liệu vận hành.

## 4. Variables và secrets trên GitHub

Repository variables tại Settings → Secrets and variables → Actions → Variables:

| Variable | Giá trị cần điền |
| --- | --- |
| `PRODUCTION_WEB_URL` | URL HTTPS web, ví dụ `https://brewlite.example.com` |
| `PRODUCTION_API_URL` | API base URL public dùng khi build web, ví dụ `https://api.brewlite.example.com/api`; nếu cùng origin thì điền URL HTTPS tương ứng |
| `PRODUCTION_API_HEALTH_URL` | URL HTTPS health thật, ví dụ `https://api.brewlite.example.com/api/health` |
| `DEPLOY_TARGET` | Tên/ID ứng dụng hoặc môi trường mà script deploy sử dụng |

Các URL trên chỉ là ví dụ, chưa phải địa chỉ BrewLite đang hoạt động.

Tạo Environment `production`, đặt secret `DEPLOY_TOKEN` tại đó. Đây là tên minh họa cho credential triển khai; nếu nền tảng dùng OIDC, SSH hoặc nhiều secret, sửa phần xác thực và tên biến theo cơ chế đã chọn. `DATABASE_URL`, `JWT_SECRET`, SMTP và secret runtime được cấu hình ở nền tảng đích, không truyền qua Docker build args hoặc commit vào repo.

Push GHCR dùng `GITHUB_TOKEN` được GitHub cấp cho run, với quyền `packages: write` ở job images; không cần tự tạo secret trùng tên. Nếu package có sẵn, kiểm tra repo có quyền publish. Hosting pull private image cần credential/quyền đọc package riêng đã cấu hình trên nền tảng; token triển khai hosting không tự có quyền GHCR.

## 5. Kích hoạt và kiểm chứng

1. Hoàn thành các phần mục 3, cấu hình mục 4 và chạy thử local/container trên DB test.
2. Bật CI trước và xác nhận đạt trên GitHub.
3. Đổi `cd.yml.example` thành `cd.yml` trong một PR đã review. Đây là lúc tag `v*` hoặc thao tác Run workflow bắt đầu chạy CD.
4. Chạy thủ công để xác minh đường đi đầy đủ, sau đó kiểm chứng trigger tag. Lưu log lint/test/build, kết quả integration/E2E, SHA image, migration, smoke test và URL thật.
5. Kiểm chứng rollback trên môi trường thử trước khi dùng cho production; ghi cách khôi phục DB và phiên bản trước vào [docs/deployment.md](../docs/deployment.md).

Hai file mẫu không phải minh chứng Task 4/5 đã đạt. Cần workflow chạy thực tế, test nghiệp vụ và bản triển khai được kiểm chứng.

## 6. Tài liệu tham khảo

- [GitHub: Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub: Reuse workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
- [GitHub: Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker: Test before push](https://docs.docker.com/build/ci/github-actions/test-before-push/)
