import type { NextFunction, Request, Response } from 'express';

export function normalizeIp(ip: string | undefined): string {
  return (ip ?? '').trim().replace(/^::ffff:/i, '');
}

// BLOCKED_IPS="1.2.3.4, 5.6.7.8" — chặn hẳn các IP đã xác định là spam.
export function parseBlockedIps(raw = process.env.BLOCKED_IPS ?? ''): Set<string> {
  return new Set(raw.split(',').map(normalizeIp).filter(Boolean));
}

// Số proxy tin cậy phía trước API (Vercel → Render = 2). Giá trị sai làm req.ip
// là IP của proxy hoặc IP giả mạo được, nên có thể chỉnh bằng TRUST_PROXY_HOPS.
export function trustProxyHops(raw = process.env.TRUST_PROXY_HOPS): number {
  if (raw !== undefined && raw.trim() !== '') {
    const hops = Number(raw);
    if (Number.isInteger(hops) && hops >= 0) return hops;
  }
  return process.env.NODE_ENV === 'production' ? 2 : 0;
}

export function ipBlocklist(blocked = parseBlockedIps()) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (blocked.size > 0 && blocked.has(normalizeIp(req.ip))) {
      res.status(403).json({ statusCode: 403, message: 'Truy cập bị từ chối.' });
      return;
    }
    next();
  };
}
