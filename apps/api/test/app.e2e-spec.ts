import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PayOS, PaymentRequests, type WebhookData } from '@payos/node';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

describe('Menu → tạo đơn → thanh toán → xác nhận (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const userId = randomUUID();
  const productId = randomUUID();
  const ingredientId = randomUUID();
  const password = 'TestPass123!';
  const email = `e2e-${userId}@example.test`;
  const checksumKey = 'payos-e2e-checksum-key';
  const cart = { items: [{ productId, size: 'S', qty: 1, toppings: [], lineTotal: 1 }] };

  beforeAll(async () => {
    // Chặn bài test có ghi dữ liệu chạy nhầm trên production.
    const databaseUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
    const databaseName = databaseUrl.pathname.slice(1);
    if (process.env.E2E_DATABASE !== '1' || databaseName !== 'brewlite_test' ||
      !['localhost', '127.0.0.1'].includes(databaseUrl.hostname)) {
      throw new Error('E2E chỉ được chạy với E2E_DATABASE=1 và database brewlite_test trên localhost');
    }

    vi.stubEnv('PAYOS_CLIENT_ID', 'payos-e2e-client-id');
    vi.stubEnv('PAYOS_API_KEY', 'payos-e2e-api-key');
    vi.stubEnv('PAYOS_CHECKSUM_KEY', checksumKey);
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: { id: userId, email, passwordHash: await bcrypt.hash(password, 4), emailVerifiedAt: new Date() },
    });
    await prisma.product.create({
      data: {
        id: productId,
        name: 'Phin sữa đá E2E',
        category: 'phin',
        allowToppings: false,
        prices: { create: { size: 'S', price: 29_000 } },
      },
    });
    await prisma.ingredient.create({
      data: {
        id: ingredientId,
        code: `E2E_${userId.replace(/-/g, '')}`,
        name: 'Cà phê E2E',
        unit: 'G',
        trackStock: true,
        onHand: new Prisma.Decimal(10),
        reserved: new Prisma.Decimal(0),
      },
    });
    await prisma.recipe.create({
      data: { productId, size: 'S', ingredientId, quantity: new Prisma.Decimal(5) },
    });

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    token = login.body.accessToken;
    expect(token).toBeTruthy();
  }, 30_000);

  beforeEach(async () => {
    await prisma.ingredient.update({
      where: { id: ingredientId },
      data: { onHand: 10, reserved: 0 },
    });
  });

  afterEach(async () => {
    if (!prisma) return;
    await prisma.pointTransaction.deleteMany({ where: { userId } });
    await prisma.payment.deleteMany({ where: { order: { userId } } });
    await prisma.order.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (!prisma) return;
    await prisma.recipe.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app?.close();
  });

  it('health kiểm tra API và PostgreSQL', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'ok' });
  });

  it('chặn đơn chưa đăng nhập và giỏ rỗng', async () => {
    await request(app.getHttpServer()).post('/api/orders').send({ items: [] }).expect(401);
    await request(app.getHttpServer())
      .post('/api/orders').set('Authorization', `Bearer ${token}`)
      .send({ items: [] }).expect(400);
  });

  it('thiếu nguyên liệu thì không tạo đơn hoặc giữ kho', async () => {
    await prisma.ingredient.update({ where: { id: ingredientId }, data: { onHand: new Prisma.Decimal(4) } });
    await request(app.getHttpServer())
      .post('/api/orders').set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId, size: 'S', qty: 1, toppings: [], lineTotal: 1 }] })
      .expect(400);
    expect(await prisma.order.count({ where: { userId } })).toBe(0);
    const ingredient = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
    expect(ingredient.reserved?.toNumber()).toBe(0);
  });

  it('đi từ menu và đăng nhập qua kiểm tra giỏ đến xác nhận đơn CARD trong cùng một phiên', async () => {
    const session = request.agent(app.getHttpServer());
    const menu = await session.get('/api/products').expect(200);
    const product = menu.body.data.find((item: { id: string }) => item.id === productId);
    expect(product.prices[0].price).toBe(29_000);
    expect(product.stockBySize.S).toBe(2);

    const productDetail = await session.get(`/api/products/${product.id}`).expect(200);
    expect(productDetail.body.data.id).toBe(productId);
    await session.post('/api/auth/login').send({ email, password }).expect(200);
    const validation = await session.post('/api/cart/validate').send(cart).expect(201);
    expect(validation.body).toMatchObject({ available: true, subtotal: 29_000 });

    const created = await session.post('/api/orders').send(cart).expect(201);
    const orderId = created.body.data.id as string;
    expect(created.body.data).toMatchObject({ status: 'PENDING', total: 29_000 });
    expect(created.body.data.items[0].recipeSnapshot).toEqual([{ ingredientId, quantity: '5.000' }]);
    const held = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
    expect(held.onHand?.toNumber()).toBe(10);
    expect(held.reserved?.toNumber()).toBe(5);

    await session.post('/api/checkout')
      .send({ orderId, method: 'CARD' }).expect(400);
    const key = randomUUID();
    const first = await session.post('/api/checkout')
      .set('Idempotency-Key', key).send({ orderId, method: 'CARD' }).expect(201);
    expect(first.body.success).toBe(true);
    expect(first.body.payment.status).toBe('SUCCESS');
    const repeated = await session.post('/api/checkout')
      .set('Idempotency-Key', key).send({ orderId, method: 'CARD' }).expect(201);
    expect(repeated.body.isDuplicate).toBe(true);

    const detail = await session.get(`/api/orders/${orderId}`).expect(200);
    expect(detail.body.data.status).toBe('PAID');
    expect(detail.body.data.payments).toHaveLength(1);
    const history = await session.get('/api/orders/me').expect(200);
    expect(history.body.data.some((order: { id: string }) => order.id === orderId)).toBe(true);
    const ingredient = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
    expect(ingredient.onHand?.toNumber()).toBe(5);
    expect(ingredient.reserved?.toNumber()).toBe(0);
  });

  it('đơn quá hạn bị hủy và nhả lượng nguyên liệu đã giữ', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/orders').set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId, size: 'S', qty: 1, toppings: [], lineTotal: 29_000 }] })
      .expect(201);
    const expiredOrderId = created.body.data.id as string;
    await prisma.order.update({
      where: { id: expiredOrderId },
      data: { reservationExpiresAt: new Date(Date.now() - 1_000) },
    });
    const status = await request(app.getHttpServer())
      .get(`/api/checkout/status/${expiredOrderId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(status.body.status).toBe('CANCELLED');
    const ingredient = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
    expect(ingredient.onHand?.toNumber()).toBe(10);
    expect(ingredient.reserved?.toNumber()).toBe(0);
  });

  it('VietQR dùng link PayOS và chỉ hoàn tất một lần khi webhook hợp lệ', async () => {
    const paymentLinkId = randomUUID();
    const checkoutUrl = `https://pay.payos.vn/web/${paymentLinkId}`;
    const createLink = vi.spyOn(PaymentRequests.prototype, 'create').mockImplementation(async (input) => ({
      ...input, paymentLinkId, checkoutUrl, qrCode: 'VietQR fixture', status: 'PENDING',
      bin: '970416', accountNumber: '1234567890', accountName: 'BREWLITE TEST', currency: 'VND',
    }));
    const lookupLink = vi.spyOn(PaymentRequests.prototype, 'get').mockResolvedValue({
      id: paymentLinkId, amount: 29_000, amountPaid: 0, amountRemaining: 29_000, status: 'PENDING',
    } as never);

    try {
      const created = await request(app.getHttpServer())
        .post('/api/orders').set('Authorization', `Bearer ${token}`)
        .send({ items: [{ productId, size: 'S', qty: 1, toppings: [], lineTotal: 1 }] })
        .expect(201);
      const payosOrderId = created.body.data.id as string;
      const getStatus = () => request(app.getHttpServer())
        .get(`/api/checkout/status/${payosOrderId}`).set('Authorization', `Bearer ${token}`).expect(200);
      const [first, second] = await Promise.all([getStatus(), getStatus()]);
      expect(first.body.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
      expect(first.body.checkoutUrl).toBe(checkoutUrl);
      expect(second.body.qrCodeUrl).toBe(first.body.qrCodeUrl);
      expect(createLink).toHaveBeenCalledTimes(1);

      await request(app.getHttpServer()).post('/api/checkout').set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', randomUUID()).send({ orderId: payosOrderId, method: 'EWALLET' }).expect(400);

      const payos = new PayOS({ clientId: 'test', apiKey: 'test', checksumKey });
      const linkRequest = createLink.mock.calls[0][0];
      const data: WebhookData = {
        orderCode: linkRequest.orderCode, amount: linkRequest.amount, description: linkRequest.description,
        accountNumber: '1234567890', reference: 'transaction-e2e', transactionDateTime: '2026-11-10 09:00:00',
        currency: 'VND', paymentLinkId, code: '00', desc: 'Success',
      };
      const sendWebhook = (data: WebhookData, signature: string) => request(app.getHttpServer())
        .post('/api/payments/payos-webhook').send({ code: '00', success: true, desc: 'Success', data, signature });
      const sign = async (data: WebhookData) => (await payos.crypto.createSignatureFromObj(data, checksumKey))!;
      await sendWebhook(data, 'invalid').expect(400);
      const wrongAmount = { ...data, amount: data.amount - 1 };
      await sendWebhook(wrongAmount, await sign(wrongAmount)).expect(200);
      expect((await getStatus()).body.status).toBe('PENDING');

      const signature = await sign(data);
      await Promise.all([sendWebhook(data, signature).expect(200), sendWebhook(data, signature).expect(200)]);
      const paid = await getStatus();
      expect(paid.body.status).toBe('PAID');
      expect(paid.body.payments).toHaveLength(1);
      expect(paid.body.payments[0]).toMatchObject({ amount: 29_000, method: 'EWALLET', status: 'SUCCESS' });
      const ingredient = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
      expect(ingredient.onHand?.toNumber()).toBe(5);
      expect(ingredient.reserved?.toNumber()).toBe(0);
      expect(await prisma.pointTransaction.count({ where: { orderId: payosOrderId } })).toBe(1);
    } finally {
      createLink.mockRestore();
      lookupLink.mockRestore();
    }
  });
});
