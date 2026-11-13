# ADR 001 — Monorepo và triển khai production

- **Trạng thái** · Chấp thuận
- **Ngày quyết định** · 2026-10-15
- **Nhóm quyết định** · Nhóm phát triển BrewLite
- **Yêu cầu liên quan** · Task 3.1, NFR-04, NFR-07

## Ngữ cảnh

Web, API, migration và tài liệu phải phát hành theo cùng phiên bản. Nhóm cần giữ một lịch sử Git chung nhưng vẫn có thể build và triển khai từng ứng dụng riêng.

## Quyết định

Dùng monorepo với `apps/web` cho Next.js, `apps/api` cho NestJS và Prisma, `docs/` cho tài liệu, `tests/` cho hướng dẫn và bộ request kiểm thử. Mỗi ứng dụng dùng `package.json` và `package-lock.json` riêng. GitHub Actions kiểm tra hai ứng dụng trên cùng commit.

Theo quyết định hosting hiện có của nhóm, web triển khai trên Vercel, API trên Render, dữ liệu production trên Supabase PostgreSQL. Web production gọi `/api` cùng origin và Next.js chuyển tiếp sang Render bằng `API_INTERNAL_URL`. Workflow áp migration trước khi triển khai API và web.

## Hệ quả và đánh đổi

Một pull request có thể đồng bộ API, giao diện, migration và tài liệu. Hai ứng dụng vẫn cần quản lý dependency, đường dẫn build và biến môi trường riêng. Đổi địa chỉ API đòi hỏi cập nhật cấu hình và build lại web. Giới hạn tài nguyên của dịch vụ hosting có thể ảnh hưởng thời gian phản hồi, xử lý hết hạn và webhook.

Đối chiếu [CI](../../../.github/workflows/ci.yml), [CD](../../../.github/workflows/cd.yml) và [hướng dẫn triển khai](../../deployment.md).
