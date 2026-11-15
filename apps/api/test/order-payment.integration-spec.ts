import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AdminService } from '../src/modules/admin/admin.service.js';
import { PaymentGatewayService } from '../src/modules/checkout/payment-gateway.service.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

describe('API tạo đơn và thanh toán với PostgreSQL test (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let gateway: PaymentGatewayService;
  let token: string;
  let otherToken: string;
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const productId = randomUUID();
  const ingredientId = randomUUID();
  const password = 'TestPass123!';
  const item = { productId, size: 'S', qty: 1, toppings: [], lineTotal: 1 };

  const auth = (value = token) => `Bearer ${value}`;
  const stock = () => prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
  const createOrder = async () => request(app.getHttpServer())
    .post('/api/orders').set('Authorization', auth())
    .send({ items: [item] }).expect(201);

  beforeAll(async () => {
    // Chỉ kết nối tới DB test riêng; các ca này tạo và xóa dữ liệu thật.
    const databaseUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
    const databaseName = databaseUrl.pathname.slice(1);
    if (process.env.E2E_DATABASE !== '1' || databaseName !== 'brewlite_test' ||
      !['localhost', '127.0.0.1'].includes(databaseUrl.hostname)) {
      throw new Error('Integration chỉ được chạy với E2E_DATABASE=1 và database brewlite_test trên localhost');
    }

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    gateway = app.get(PaymentGatewayService);

    await prisma.user.createMany({ data: [
      { id: userId, email: `integration-${userId}@example.test`, passwordHash: await bcrypt.hash(password, 4), emailVerifiedAt: new Date() },
      { id: otherUserId, email: `integration-${otherUserId}@example.test`, passwordHash: await bcrypt.hash(password, 4), emailVerifiedAt: new Date() },
    ] });
    await prisma.product.create({
      data: { id: productId, name: 'Cà phê integration', category: 'phin', allowToppings: false,
        prices: { create: { size: 'S', price: 29_000 } } },
    });
    await prisma.ingredient.create({
      data: { id: ingredientId, code: `INT_${userId.replace(/-/g, '')}`, name: 'Cà phê integration',
        unit: 'G', trackStock: true, onHand: new Prisma.Decimal(10), reserved: new Prisma.Decimal(0) },
    });
    await prisma.recipe.create({
      data: { productId, size: 'S', ingredientId, quantity: new Prisma.Decimal(6) },
    });

    const login = async (id: string) => {
      const response = await request(app.getHttpServer()).post('/api/auth/login')
        .send({ email: `integration-${id}@example.test`, password }).expect(200);
      return response.body.accessToken as string;
    };
    token = await login(userId);
    otherToken = await login(otherUserId);
  }, 30_000);

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!prisma) return;
    await prisma.pointTransaction.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: [userId, otherUserId] } } } });
    await prisma.order.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await prisma.ingredient.update({ where: { id: ingredientId },
      data: { onHand: new Prisma.Decimal(10), reserved: new Prisma.Decimal(0) } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.recipe.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await app?.close();
  });

  it('chi tiết menu và giỏ báo thiếu nguyên liệu mà không giữ kho', async () => {
    const detail = await request(app.getHttpServer()).get(`/api/products/${productId}`).expect(200);
    expect(detail.body.data.stockBySize.S).toBe(1);

    const validation = await request(app.getHttpServer()).post('/api/cart/validate')
      .send({ items: [{ ...item, qty: 2 }] }).expect(201);
    expect(validation.body.available).toBe(false);
    expect(validation.body.shortages[0]).toMatchObject({ ingredientId, required: '12.000', available: '10.000' });
    expect((await stock()).reserved?.toNumber()).toBe(0);
    expect(await prisma.order.count({ where: { userId } })).toBe(0);
  });

  it('API từ chối payload sai, sản phẩm và topping không hợp lệ', async () => {
    await request(app.getHttpServer()).post('/api/orders').set('Authorization', auth())
      .send({ items: [{ ...item, qty: 0 }] }).expect(400);
    await request(app.getHttpServer()).post('/api/orders').set('Authorization', auth())
      .send({ items: [{ ...item, productId: randomUUID() }] }).expect(400);
    await request(app.getHttpServer()).post('/api/orders').set('Authorization', auth())
      .send({ items: [{ ...item, toppings: ['Không tồn tại'] }] }).expect(400);
    expect(await prisma.order.count({ where: { userId } })).toBe(0);
    expect((await stock()).reserved?.toNumber()).toBe(0);
  });

  it('hai đơn cùng tranh một phần nguyên liệu chỉ tạo được một đơn', async () => {
    const place = (accessToken: string) => request(app.getHttpServer()).post('/api/orders')
      .set('Authorization', auth(accessToken)).send({ items: [item] });
    const responses = await Promise.all([place(token), place(otherToken)]);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => [400, 409].includes(response.status))).toHaveLength(1);
    expect(responses.find((response) => response.status === 201)?.body.data.total).toBe(29_000);
    expect(await prisma.order.count({ where: { userId: { in: [userId, otherUserId] } } })).toBe(1);
    expect((await stock()).reserved?.toNumber()).toBe(6);
  });

  it('người khác không thể đọc hoặc thanh toán đơn; lượng giữ vẫn nguyên', async () => {
    const orderId = (await createOrder()).body.data.id as string;
    await request(app.getHttpServer()).get(`/api/orders/${orderId}`)
      .set('Authorization', auth(otherToken)).expect(404);
    await request(app.getHttpServer()).post('/api/checkout')
      .set('Authorization', auth(otherToken)).set('Idempotency-Key', randomUUID())
      .send({ orderId, method: 'CARD' }).expect(404);
    expect((await stock()).reserved?.toNumber()).toBe(6);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(0);
  });

  it('thanh toán lỗi giữ kho; gửi lại cùng key không xử lý lại; key mới thành công chỉ trừ một lần', async () => {
    const orderId = (await createOrder()).body.data.id as string;
    const charge = vi.spyOn(gateway, 'charge')
      .mockResolvedValueOnce({ success: false, gatewayRef: 'TEST-FAILED' })
      .mockResolvedValueOnce({ success: true, gatewayRef: 'TEST-SUCCESS' });
    const sendPayment = (key: string) => request(app.getHttpServer()).post('/api/checkout')
      .set('Authorization', auth()).set('Idempotency-Key', key)
      .send({ orderId, method: 'CARD' }).expect(201);

    const failedKey = randomUUID();
    const failed = await sendPayment(failedKey);
    expect(failed.body.success).toBe(false);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PAYMENT_FAILED');
    expect((await stock()).reserved?.toNumber()).toBe(6);
    expect((await stock()).onHand?.toNumber()).toBe(10);

    const repeated = await sendPayment(failedKey);
    expect(repeated.body.isDuplicate).toBe(true);
    expect(charge).toHaveBeenCalledTimes(1);

    const success = await sendPayment(randomUUID());
    expect(success.body.success).toBe(true);
    expect(charge).toHaveBeenCalledTimes(2);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PAID');
    expect(await prisma.payment.count({ where: { orderId } })).toBe(2);
    expect((await stock()).onHand?.toNumber()).toBe(4);
    expect((await stock()).reserved?.toNumber()).toBe(0);
  });

  it('admin hủy hai đơn đã trả tiền đồng thời chỉ thu hồi tối đa số điểm còn lại', async () => {
    const otherIngredient = await prisma.ingredient.create({
      data: { code: 'CANCEL_' + userId, name: 'Nguyên liệu thứ hai', unit: 'G', onHand: 10, reserved: 0 },
    });
    try {
      await prisma.user.update({ where: { id: userId }, data: { loyaltyPoints: 3 } });
      const orders = await Promise.all([ingredientId, otherIngredient.id].map(id => prisma.order.create({
        data: {
          userId, total: 30_000, status: 'PAID', inventoryState: 'CONSUMED', loyaltyPointsEarned: 3,
          items: { create: { productId, productName: 'Cà phê integration', lineTotal: 30_000,
            recipeSnapshot: [{ ingredientId: id, quantity: '6' }] } },
        },
      })));

      // Giữ hàng user từ trước để buộc cả hai lượt hủy cùng chạm đến bước thu hồi.
      let signalLocked!: () => void;
      let release!: () => void;
      const locked = new Promise<void>(resolve => { signalLocked = resolve; });
      const unlocked = new Promise<void>(resolve => { release = resolve; });
      const hold = prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
        signalLocked();
        await unlocked;
      });
      await Promise.race([locked, hold]);
      const admin = app.get(AdminService);
      const cancellations = Promise.allSettled(orders.map(order => admin.updateStatus(order.id, 'CANCELLED')));
      try {
        await vi.waitFor(async () => {
          const [waiting] = await prisma.$queryRaw<{ count: number }[]>`
            SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query LIKE '%"users"%' AND query NOT LIKE '%pg_stat_activity%'
          `;
          expect(waiting.count).toBeGreaterThanOrEqual(2);
        }, { interval: 25, timeout: 1_500 });
      } finally {
        release();
        await hold;
        await cancellations;
      }

      expect((await cancellations).map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
      expect(await prisma.order.count({ where: { userId, status: 'CANCELLED', inventoryState: 'RESTORED' } })).toBe(2);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints).toBe(0);
      expect(await prisma.pointTransaction.findMany({ where: { userId, type: 'REFUND' } }))
        .toMatchObject([{ points: -3, balanceAfter: 0 }]);
      expect((await stock()).onHand?.toNumber()).toBe(16);
      expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: otherIngredient.id } })).onHand?.toNumber()).toBe(16);
    } finally {
      await prisma.ingredient.delete({ where: { id: otherIngredient.id } });
    }
  });

  it('thanh toán sau hạn bị từ chối, hủy đơn và trả nguyên liệu', async () => {
    const orderId = (await createOrder()).body.data.id as string;
    await prisma.order.update({ where: { id: orderId },
      data: { reservationExpiresAt: new Date(Date.now() - 1_000) } });
    await request(app.getHttpServer()).post('/api/checkout')
      .set('Authorization', auth()).set('Idempotency-Key', randomUUID())
      .send({ orderId, method: 'CARD' }).expect(400);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('CANCELLED');
    expect(order.inventoryState).toBe('RELEASED');
    expect((await stock()).reserved?.toNumber()).toBe(0);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(0);
  });
});
