import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const RATE_LIMIT_MESSAGE =
  'Bạn thao tác quá nhanh hoặc quá nhiều lần. Vui lòng thử lại sau ít phút.';

// Giới hạn theo IP cho từng endpoint nhạy cảm. `blockDuration` khóa IP vi phạm
// trong thời gian dài hơn cửa sổ đếm để bot không thử lại liên tục.
export const AUTH_LIMITS = {
  // Mỗi lần đăng ký gửi một email OTP nên giới hạn chặt nhất.
  register: { limit: 5, ttl: HOUR, blockDuration: HOUR },
  // Gửi lại OTP và quên mật khẩu cũng gửi email.
  sendEmail: { limit: 5, ttl: HOUR, blockDuration: HOUR },
  verifyEmail: { limit: 10, ttl: 10 * MINUTE, blockDuration: 10 * MINUTE },
  login: { limit: 10, ttl: MINUTE, blockDuration: 5 * MINUTE },
  resetPassword: { limit: 10, ttl: 10 * MINUTE, blockDuration: 10 * MINUTE },
} as const;

export const THROTTLER_OPTIONS: ThrottlerModuleOptions = {
  // Giới hạn chung cho mọi endpoint; đủ rộng cho nhiều người dùng chung một IP (mạng trường).
  throttlers: [{ name: 'default', ttl: MINUTE, limit: 300 }],
  errorMessage: RATE_LIMIT_MESSAGE,
  // Test tích hợp/E2E gọi API liên tục từ một IP nên không áp giới hạn khi NODE_ENV=test.
  skipIf: (context: ExecutionContext) =>
    process.env.NODE_ENV === 'test' ||
    context.switchToHttp().getRequest<{ method?: string }>().method === 'OPTIONS',
};

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly auditLogger = new Logger('RateLimit');

  // Ghi log IP bị chặn để đưa vào BLOCKED_IPS và kiểm tra cấu hình TRUST_PROXY_HOPS.
  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<{
      ip?: string;
      method?: string;
      originalUrl?: string;
      headers: Record<string, string | string[] | undefined>;
    }>();
    this.auditLogger.warn(
      `Vượt giới hạn ip=${req.ip ?? '-'} xff=${String(req.headers['x-forwarded-for'] ?? '-')} ` +
        `${req.method ?? '-'} ${req.originalUrl ?? '-'}`,
    );
    return super.throwThrottlingException(context, detail);
  }
}
