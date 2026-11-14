import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';

describe('Admin quản lý voucher và khách đổi điểm', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const adminId = randomUUID();
  const customerId = randomUUID();
  const rewardCode = 'REWARD-' + randomUUID().slice(0, 8).toUpperCase();
  const publicCode = 'PUBLIC-' + randomUUID().slice(0, 8).toUpperCase();
  const baseForm = { discountType: 'FIXED_AMOUNT', discountValue: 10_000, minOrderValue: 30_000 };
  const route = '/api/admin/promotions';
  const api = () => request(app.getHttpServer());
  const bearer = (id: string) => 'Bearer ' + new JwtService({
    secret: process.env.JWT_SECRET || 'super-secret-key',
  }).sign({ sub: id });
  const overview = () => api().get('/api/rewards').set('Authorization', bearer(customerId)).expect(200);

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/');
    if (process.env.E2E_DATABASE !== '1' || url.pathname !== '/brewlite_test' ||
        !['localhost', '127.0.0.1'].includes(url.hostname)) {
      throw new Error('Chỉ chạy với E2E_DATABASE=1 và database brewlite_test trên localhost');
    }
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.createMany({
      data: [
        { id: adminId, email: `${adminId}@example.test`, passwordHash: 'test', role: 'ADMIN' },
        { id: customerId, email: `${customerId}@example.test`, passwordHash: 'test', loyaltyPoints: 200 },
      ],
    });
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      const codes = { code: { in: [rewardCode, publicCode] } };
      await prisma.pointTransaction.deleteMany({ where: { userId: customerId } });
      await prisma.userVoucher.deleteMany({ where: { userId: customerId } });
      await prisma.rewardItem.deleteMany({ where: { promotion: codes } });
      await prisma.promotion.deleteMany({ where: codes });
      await prisma.user.deleteMany({ where: { id: { in: [adminId, customerId] } } });
    }
    await app?.close();
  });

  it('tạo và sửa voucher đổi điểm, đồng bộ giá điểm với trang Đổi quà và giữ voucher đã cấp', async () => {
    const admin = bearer(adminId);
    const customer = bearer(customerId);
    const endDate = new Date(Date.now() + 86_400_000).toISOString();
    const create = { ...baseForm, code: rewardCode, description: 'Giảm 10.000đ', pointsCost: 45, endDate };
    await api().post(route).set('Authorization', customer).send(create).expect(403);
    await api().post(route).set('Authorization', admin).send({ ...create, pointsCost: 1.5 }).expect(400);
    const { id } = (await api().post(route).set('Authorization', admin).send(create).expect(201)).body.data;
    const reward = (await overview()).body.rewards.find((item: { code: string }) => item.code === rewardCode);
    expect(reward).toMatchObject({ code: rewardCode, pointsCost: 45, endDate });
    const publicPromotions = (await api().get('/api/promotions').expect(200)).body;
    expect(publicPromotions).not.toContainEqual(expect.objectContaining({ code: rewardCode }));
    const edit = (patch: object, token = admin) => api().patch(route + '/' + id).set('Authorization', token).send(patch);
    await edit({ pointsCost: 30 }, customer).expect(403);
    await edit({ pointsCost: 30, description: 'Ưu đãi mới', discountValue: 12_000 }).expect(200);
    expect((await overview()).body.rewards).toContainEqual(expect.objectContaining({
      id: reward.id, code: rewardCode, description: 'Ưu đãi mới', pointsCost: 30,
    }));
    const redeem = () => api().post('/api/rewards/redeem').set('Authorization', customer).send({ rewardItemId: reward.id });
    const first = await redeem().expect(200);
    expect(first.body).toMatchObject({ points: 170, code: rewardCode });
    await edit({ discountValue: 20_000 }).expect(400);
    await edit({ endDate: null }).expect(400);
    await edit({ pointsCost: 50 }).expect(200);
    const edited = (await overview()).body;
    expect(edited.points).toBe(170);
    expect(edited.vouchers).toContainEqual(expect.objectContaining({ code: rewardCode, count: 1, discountValue: 12_000, endDate }));
    expect(edited.rewards).toContainEqual(expect.objectContaining({ id: reward.id, pointsCost: 50 }));
    expect((await redeem().expect(200)).body.points).toBe(120);
    const list = (await api().get(route).set('Authorization', admin).expect(200)).body.data;
    expect(list).toContainEqual(expect.objectContaining({ id, pointsCost: 50, canEditTerms: false }));

    const toggle = () => api().patch(route + '/' + id + '/active').set('Authorization', admin).expect(200);
    await toggle();
    expect((await overview()).body.rewards).not.toContainEqual(expect.objectContaining({ id: reward.id }));
    await redeem().expect(404);
    await toggle();
    expect((await overview()).body.rewards).toContainEqual(expect.objectContaining({ id: reward.id }));
  });

  it('voucher thường vẫn xuất hiện công khai và sửa được khi chưa sử dụng', async () => {
    const admin = bearer(adminId);
    const { id } = (await api().post(route).set('Authorization', admin)
      .send({ ...baseForm, code: publicCode }).expect(201)).body.data;
    expect((await api().get('/api/promotions').expect(200)).body).toContainEqual(
      expect.objectContaining({ code: publicCode, isRewardOnly: false }),
    );
    expect((await overview()).body.rewards).not.toContainEqual(expect.objectContaining({ code: publicCode }));
    await api().patch(route + '/' + id).set('Authorization', admin).send({ pointsCost: 25 }).expect(400);
    const edited = await api().patch(route + '/' + id).set('Authorization', admin)
      .send({ discountType: 'PERCENTAGE', discountValue: 15, maxDiscount: 20_000 }).expect(200);
    expect(edited.body.data).toMatchObject({ discountType: 'PERCENTAGE', discountValue: 15, maxDiscount: 20_000 });
  });
});
