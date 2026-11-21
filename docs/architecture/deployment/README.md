# Task 3.2 — Sơ đồ triển khai

Sơ đồ trong báo cáo được phân rã thành bốn hình vector theo cách trình bày UML của bản nhóm: node 3D, stereotype, artifact nền nhạt và note màu vàng. Chữ, đường nối và đầu mũi tên được giữ ở dạng vector để in A4.

| Hình | Phạm vi | Nguồn được `main.tex` nạp qua Task 3.2 |
| --- | --- | --- |
| 3.2a | Tổng quan các môi trường và dịch vụ | [overview.tex](overview.tex) |
| 3.2b | Production: Vercel, Render, Supabase, PayOS, Brevo | [production.tex](production.tex) |
| 3.2c | Local: Docker Compose, cổng host/container, volume | [local.tex](local.tex) |
| 3.2d | Release: CI gate, GHCR, migration, deploy, smoke test | [release.tex](release.tex) |

Mỗi nguồn `.tex` nạp ảnh PDF vector tương ứng; SVG cùng tên là bản vector có thể chỉnh sửa. [render_diagrams.py](render_diagrams.py) sinh bốn SVG/PDF bằng Python và PyMuPDF. Bố cục được thiết kế riêng cho từng phạm vi để hạn chế thu nhỏ chữ. Biên dịch [main.tex](../../requirements/task1/main.tex) để xem bố cục cuối cùng. Nội dung đã đối chiếu với Docker Compose, rewrite Next.js và workflows ngày 20/11/2026.

Sơ đồ gộp trước đây được giữ lại để tham khảo:

![Sơ đồ triển khai BrewLite trước khi phân rã](deployment.svg)

[Mã nguồn PlantUML](deployment.puml) · [Bản PNG](deployment.png) · [Bản draw.io nhóm gửi](deployment-reference.drawio)

Các bản PlantUML/PNG/PDF gộp và draw.io lưu thông tin tham khảo ban đầu của nhóm; báo cáo hiện dùng bốn hình phân rã ở trên.

| Nút triển khai | Thành phần và mã nguồn tương ứng |
| --- | --- |
| Thiết bị khách hàng / quản trị viên | Trình duyệt truy cập Next.js qua HTTPS 443. Các màn hình nằm trong [apps/web/src/app](../../../apps/web/src/app/). |
| Vercel | Dịch vụ web của [apps/web](../../../apps/web/). Biến build `NEXT_PUBLIC_API_URL=/api` và `API_INTERNAL_URL` điều khiển [rewrite Next.js](../../../apps/web/next.config.ts). Theo dõi log build và runtime trên Vercel. |
| Render | [Dockerfile API](../../../apps/api/Dockerfile) chạy NestJS trên `PORT`, mặc định 3001 khi không có biến này. Render cung cấp HTTPS 443, cấu hình runtime `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `PAYOS_*` và `BREVO_*`. [Health check](../../../apps/api/src/app.controller.ts) kiểm tra PostgreSQL qua `GET /api/health`. API ghi log NestJS trên Render. |
| Supabase | PostgreSQL có lưu trữ bền vững. API dùng kết nối TLS qua Session pooler, cổng 5432 theo cấu hình triển khai. [Schema và migration Prisma](../../../apps/api/prisma/) nằm cùng API. |
| PayOS / Brevo | PayOS gửi webhook tới `POST /api/payments/payos-webhook` trên Render. Liên kết thanh toán và đối soát nằm trong [CheckoutModule](../../../apps/api/src/modules/checkout/). [EmailModule](../../../apps/api/src/modules/email/) dùng Brevo qua HTTPS cho production và hỗ trợ SMTP. |
| Docker Compose local | [docker-compose.yml](../../../docker-compose.yml) ghép cấu hình web, API và PostgreSQL. Web gọi `api:3001`, API gọi `db:5432`, volume `brewlite_pgdata` lưu dữ liệu. Web kiểm tra đường dẫn `/`, API kiểm tra `/api/products`, DB kiểm tra bằng `pg_isready`. Compose ghi log `json-file` có xoay vòng. |
| GitHub Actions và GHCR | [CI](../../../.github/workflows/ci.yml) kiểm thử trên PostgreSQL tạm. [CD](../../../.github/workflows/cd.yml) dùng secrets của environment `production`, lưu hai image theo SHA lên GHCR, chạy migration Supabase, phát hành API và web, rồi chạy smoke test. Render và Vercel build từ commit phát hành. |

Xem thêm [hướng dẫn cấu hình, migration và rollback](../../deployment.md) và [kiến trúc C4](../system-architecture.md).
