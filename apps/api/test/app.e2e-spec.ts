import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

describe('Menu → tạo đơn → thanh toán → xác nhận (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let orderId: string;
  const userId = randomUUID();
  const productId = randomUUID();
  const ingredientId = randomUUID();
  const password = 'TestPass123!';
  const email = `e2e-${userId}@example.test`;

  beforeAll(async () => {
    // Chặn bài test có ghi dữ liệu chạy nhầm trên production.
    const databaseUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
    const databaseName = databaseUrl.pathname.slice(1);
    if (process.env.E2E_DATABASE !== '1' || databaseName !== 'brewlite_test' ||
      !['localhost', '127.0.0.1'].includes(databaseUrl.hostname)) {
      throw new Error('E2E chỉ được chạy với E2E_DATABASE=1 và database brewlite_test trên localhost');
    }

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

  afterAll(async () => {
    if (!prisma) return;
    await prisma.pointTransaction.deleteMany({ where: { userId } });
    await prisma.payment.deleteMany({ where: { order: { userId } } });
    await prisma.order.deleteMany({ where: { userId } });
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

  it('menu trả giá và stock theo công thức', async () => {
    const response = await request(app.getHttpServer()).get('/api/products').expect(200);
    const product = response.body.data.find((item: { id: string }) => item.id === productId);
    expect(product.prices[0].price).toBe(29_000);
    expect(product.stockBySize.S).toBe(2);
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
    await prisma.ingredient.update({ where: { id: ingredientId }, data: { onHand: new Prisma.Decimal(10) } });
  });

  it('tạo đơn PENDING, tính lại giá và giữ nguyên liệu', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders').set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId, size: 'S', qty: 1, toppings: [], lineTotal: 1 }] })
      .expect(201);
    orderId = response.body.data.id;
    expect(orderId).toBeTruthy();
    expect(response.body.data.status).toBe('PENDING');
    expect(response.body.data.total).toBe(29_000);
    expect(response.body.data.items[0].recipeSnapshot).toEqual([{ ingredientId, quantity: '5.000' }]);
    const ingredient = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
    expect(ingredient.onHand?.toNumber()).toBe(10);
    expect(ingredient.reserved?.toNumber()).toBe(5);
  });

  it('checkout yêu cầu Idempotency-Key', async () => {
    await request(app.getHttpServer())
      .post('/api/checkout').set('Authorization', `Bearer ${token}`)
      .send({ orderId, method: 'CARD' }).expect(400);
  });

  it('thanh toán CARD, xác nhận đơn và không trừ kho hai lần', async () => {
    const key = randomUUID();
    const first = await request(app.getHttpServer())
      .post('/api/checkout').set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key).send({ orderId, method: 'CARD' }).expect(201);
    expect(first.body.success).toBe(true);
    expect(first.body.payment.status).toBe('SUCCESS');
    const repeated = await request(app.getHttpServer())
      .post('/api/checkout').set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key).send({ orderId, method: 'CARD' }).expect(201);
    expect(repeated.body.isDuplicate).toBe(true);

    const detail = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(detail.body.data.status).toBe('PAID');
    expect(detail.body.data.payments).toHaveLength(1);
    const history = await request(app.getHttpServer())
      .get('/api/orders/me').set('Authorization', `Bearer ${token}`).expect(200);
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
    expect(ingredient.onHand?.toNumber()).toBe(5);
    expect(ingredient.reserved?.toNumber()).toBe(0);
  });
});
