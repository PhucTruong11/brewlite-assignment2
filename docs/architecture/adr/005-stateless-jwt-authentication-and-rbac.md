# ADR 005 — Xác thực JWT và phân quyền theo vai trò

- **Trạng thái** · Chấp thuận
- **Ngày quyết định** · 2026-10-24
- **Nhóm quyết định** · Nhóm phát triển BrewLite
- **Yêu cầu liên quan** · Task 3.1, FR-05, FR-06, FR-07, NFR-02

## Ngữ cảnh

Khách cần truy cập đơn, lịch sử và điểm của mình. Nhân viên dùng tài khoản quản trị để vận hành đơn và tồn kho. API cần xác định danh tính, vai trò và quyền sở hữu tài nguyên trên mỗi yêu cầu.

## Quyết định

- API ký JWT khi đăng nhập thành công. Payload có `sub`, `email` và `role`. Thời hạn hiện tại là bảy ngày. Web nhận cookie `access_token` với `HttpOnly`, `SameSite=Lax` và `Secure` trong production.
- `JwtStrategy` ưu tiên cookie và hỗ trợ Bearer token. Sau khi xác minh token, strategy đọc tài khoản từ PostgreSQL. `RolesGuard` kiểm tra vai trò hiện tại của `request.user` cho API quản trị. API đơn hàng và checkout kiểm tra quyền sở hữu.
- Mật khẩu được băm bằng bcrypt. Luồng đăng ký dùng OTP qua email, lưu bản băm và đặt thời hạn mười phút.

## Hệ quả và đánh đổi

API xác thực dựa trên token mà không cần kho session riêng. API đọc lại tài khoản ở mỗi yêu cầu được bảo vệ để dùng vai trò hiện tại và từ chối tài khoản đã bị xóa. Điều này phát sinh một truy vấn PostgreSQL. Cookie giúp web gửi thông tin xác thực qua proxy cùng origin. Đăng xuất xóa cookie phía trình duyệt. Token đã cấp vẫn có thời hạn riêng.

Đối chiếu [AuthController](../../../apps/api/src/modules/auth/auth.controller.ts), [JwtStrategy](../../../apps/api/src/modules/auth/strategies/jwt.strategy.ts) và [RolesGuard](../../../apps/api/src/modules/auth/guards/roles.guard.ts).
