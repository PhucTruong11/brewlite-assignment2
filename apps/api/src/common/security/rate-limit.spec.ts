import { Controller, Post, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ipBlocklist, normalizeIp, parseBlockedIps, trustProxyHops } from './ip-blocklist.js';
import { AppThrottlerGuard, RATE_LIMIT_MESSAGE, THROTTLER_OPTIONS } from './rate-limit.js';

@Controller('probe')
class ProbeController {
  @Throttle({ default: { limit: 2, ttl: 60_000, blockDuration: 60_000 } })
  @Post('strict')
  strict() {
    return { ok: true };
  }
}

describe('rate limiting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Vitest đặt NODE_ENV=test, khi đó cấu hình thật bỏ qua giới hạn; bài này cần bật giới hạn.
    vi.stubEnv('NODE_ENV', 'development');
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(THROTTLER_OPTIONS)],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('returns 429 with a Vietnamese message after the route limit is exceeded', async () => {
    const server = app.getHttpServer();
    await request(server).post('/probe/strict').expect(201);
    await request(server).post('/probe/strict').expect(201);
    const blocked = await request(server).post('/probe/strict').expect(429);
    expect(blocked.body.message).toBe(RATE_LIMIT_MESSAGE);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});

describe('IP blocklist', () => {
  it('normalizes IPv4-mapped IPv6 addresses and ignores blanks', () => {
    expect(normalizeIp('::ffff:1.2.3.4')).toBe('1.2.3.4');
    expect([...parseBlockedIps(' 1.2.3.4, ,::ffff:5.6.7.8 ')]).toEqual(['1.2.3.4', '5.6.7.8']);
  });

  it('answers 403 for a blocked IP and lets others through', () => {
    const middleware = ipBlocklist(new Set(['1.2.3.4']));
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const next = vi.fn();

    middleware({ ip: '::ffff:1.2.3.4' } as never, { status } as never, next);
    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    middleware({ ip: '9.9.9.9' } as never, { status } as never, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reads the trusted proxy hop count from TRUST_PROXY_HOPS with a safe default', () => {
    expect(trustProxyHops('3')).toBe(3);
    expect(trustProxyHops('abc')).toBe(trustProxyHops(undefined));
  });
});
