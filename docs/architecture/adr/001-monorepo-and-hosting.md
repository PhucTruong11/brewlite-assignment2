# ADR-001: Monorepo và hosting production

- **Trạng thái:** đề xuất để nhóm rà soát.
- **Bối cảnh:** Assignment 2 yêu cầu Next.js, NestJS, PostgreSQL, kiểm thử và URL HTTPS công khai.
- **Quyết định:** đặt web ở `apps/web`, API ở `apps/api`, tài liệu ở `docs`. Web triển khai trên Vercel, API trên Render, dữ liệu trên Supabase PostgreSQL. Trình duyệt gọi `/api` cùng origin; Next.js proxy sang API Render. API giữ `DATABASE_URL` và các bí mật ở Render Environment.
- **Hệ quả:** frontend phải build với `API_INTERNAL_URL` đúng API public; đổi URL API cần redeploy web. Vercel/Render không tự triển khai từ thư mục local này cho tới khi được liên kết với repository chứa cấu trúc `apps/`. DB migration chạy bằng `prisma migrate deploy`, không seed lại DB production mỗi lần release.
- **Rủi ro:** free tier có thể sleep hoặc giới hạn tài nguyên; cron xử lý đơn quá hạn chỉ chạy khi API đang hoạt động. Cần kiểm tra webhook PayOS và trạng thái đơn trước khi tuyên bố thanh toán production đã hoàn chỉnh.
