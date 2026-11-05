# Docker Compose cho BrewLite Assignment 2

Bản Assignment 2 dùng [Vercel, Render và Supabase](../docs/deployment.md) để chạy và demo. Các file Compose ở đây chỉ để tái tạo stack local khi cần kiểm thử; chúng **không điều khiển** production.

Từ thư mục gốc repo, `docker-compose.yml` ghép ba dịch vụ: `db` PostgreSQL, `api` từ `apps/api/Dockerfile` và `web` từ `apps/web/Dockerfile`. Dữ liệu local nằm trong volume của project Compose `brewlite-assignment2`, tách khỏi DB Supabase.

## Chạy local khi cần

1. Tạo `apps/api/.env` từ `apps/api/.env.example` và đặt `JWT_SECRET` riêng. Không commit file chứa secret.
2. Kiểm tra cấu hình, build và bật DB:

```powershell
docker compose config --quiet
docker compose build api web
docker compose up -d --wait db
```

3. Với **DB local trống**, áp migration và tạo dữ liệu demo một lần:

```powershell
docker compose run --rm --no-deps api npx prisma migrate deploy
docker compose run --rm --no-deps api npx prisma db seed
docker compose run --rm --no-deps api npm run catalog:bootstrap
docker compose run --rm --no-deps api npm run inventory:demo-stock
```

4. Bật ứng dụng và kiểm tra:

```powershell
docker compose up -d --wait
docker compose ps
docker compose logs --tail=100 api web
```

Web local ở `http://localhost:3000`, API ở `http://localhost:3001/api`. Trình duyệt gọi `/api` qua web; Next.js chuyển tiếp tới container `api`. Dừng bằng `docker compose stop`; không dùng `down -v` nếu cần giữ dữ liệu local.

**DB đã có dữ liệu:** chỉ chạy `npx prisma migrate deploy` khi có migration mới. Không chạy lại seed hoặc script nạp tồn demo trên dữ liệu đang sử dụng. Không chạy các lệnh Compose này với `DATABASE_URL` Supabase.
