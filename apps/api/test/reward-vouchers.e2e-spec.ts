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
  const secondCustomerId = randomUUID();
  const rewardCode = 'REWARD-' + randomUUID().slice(0, 8).toUpperCase();
  const publicCode = 'PUBLIC-' + randomUUID().slice(0, 8).toUpperCase();
  const lastVoucherCode = 'LAST-' + randomUUID().slice(0, 8).toUpperCase();
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
        { id: secondCustomerId, email: `${secondCustomerId}@example.test`, passwordHash: 'test', loyaltyPoints: 50 },
      ],
    });
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      const codes = { code: { in: [rewardCode, publicCode, lastVoucherCode] } };
      const users = { in: [customerId, secondCustomerId] };
      await prisma.pointTransaction.deleteMany({ where: { userId: users } });
      await prisma.userVoucher.deleteMany({ where: { userId: users } });
      await prisma.rewardItem.deleteMany({ where: { promotion: codes } });
      await prisma.promotion.deleteMany({ where: codes });
      await prisma.user.deleteMany({ where: { id: { in: [adminId, customerId, secondCustomerId] } } });
    }
    await app?.close();
  });

  it('tạo và sửa voucher đổi điểm, đồng bộ giá điểm với trang Đổi quà và giữ voucher đã cấp', async () => {
    const admin = bearer(adminId);
    const customer = bearer(customerId);
    const endDate = new Date(Date.now() + 86_400_000).toISOString();
    const create = { ...baseForm, code: rewardCode, description: 'Giảm 10.000đ', pointsCost: 45, redemptionLimit: 3, endDate };
    await api().post(route).set('Authorization', customer).send(create).expect(403);
    await api().post(route).set('Authorization', admin).send({ ...create, pointsCost: 1.5 }).expect(400);
    await api().post(route).set('Authorization', admin).send({ ...create, redemptionLimit: undefined }).expect(400);
    await api().post(route).set('Authorization', admin).send({ ...create, redemptionLimit: 0 }).expect(400);
    await api().post(route).set('Authorization', admin).send({ ...create, redemptionLimit: 2.5 }).expect(400);
    const { id } = (await api().post(route).set('Authorization', admin).send(create).expect(201)).body.data;
    const reward = (await overview()).body.rewards.find((item: { code: string }) => item.code === rewardCode);
    expect(reward).toMatchObject({ code: rewardCode, pointsCost: 45, endDate, redemptionLimit: 3, remainingCount: 3 });
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
    expect(list).toContainEqual(expect.objectContaining({
      id, pointsCost: 50, redemptionLimit: 3, remainingCount: 1, canEditTerms: false,
    }));

    const toggle = () => api().patch(route + '/' + id + '/active').set('Authorization', admin).expect(200);
    await toggle();
    expect((await overview()).body.rewards).not.toContainEqual(expect.objectContaining({ id: reward.id }));
    await redeem().expect(404);
    await toggle();
    expect((await overview()).body.rewards).toContainEqual(expect.objectContaining({ id: reward.id }));
  });

  it('voucher thường vẫn xuất hiện công khai và sửa được khi chưa sử dụng', async () => {
    const admin = bearer(adminId);
    await api().post(route).set('Authorization', admin)
      .send({ ...baseForm, code: publicCode, redemptionLimit: 10 }).expect(400);
    const { id } = (await api().post(route).set('Authorization', admin)
      .send({ ...baseForm, code: publicCode }).expect(201)).body.data;
    expect((await api().get('/api/promotions').expect(200)).body).toContainEqual(
      expect.objectContaining({ code: publicCode, isRewardOnly: false }),
    );
    expect((await overview()).body.rewards).not.toContainEqual(expect.objectContaining({ code: publicCode }));
    await api().patch(route + '/' + id).set('Authorization', admin).send({ pointsCost: 25 }).expect(400);
    await api().patch(route + '/' + id).set('Authorization', admin).send({ redemptionLimit: 10 }).expect(400);
    const edited = await api().patch(route + '/' + id).set('Authorization', admin)
      .send({ discountType: 'PERCENTAGE', discountValue: 15, maxDiscount: 20_000 }).expect(200);
    expect(edited.body.data).toMatchObject({ discountType: 'PERCENTAGE', discountValue: 15, maxDiscount: 20_000 });
  });

  it('mã cũ không giới hạn có thể đặt giới hạn; hai khách đổi đồng thời chỉ nhận một suất cuối', async () => {
    const customers = [customerId, secondCustomerId];
    const admin = bearer(adminId);
    // Dữ liệu có từ trước migration có redemptionLimit = null.
    const promotion = await prisma.promotion.create({
      data: {
        ...baseForm, code: lastVoucherCode, isRewardOnly: true,
        rewardItems: { create: { name: 'Suất cuối', pointsCost: 10 } },
      },
      include: { rewardItems: true },
    });
    const [{ id: rewardItemId }] = promotion.rewardItems;
    const editLimit = (redemptionLimit: number) => api().patch(route + '/' + promotion.id)
      .set('Authorization', admin).send({ redemptionLimit });
    const redeem = (userId: string) => api().post('/api/rewards/redeem')
      .set('Authorization', bearer(userId)).send({ rewardItemId });
    expect((await overview()).body.rewards).toContainEqual(expect.objectContaining({
      id: rewardItemId, redemptionLimit: null, remainingCount: null,
    }));
    await editLimit(1).expect(200);
    const balances = async () => new Map((await prisma.user.findMany({
      where: { id: { in: customers } }, select: { id: true, loyaltyPoints: true },
    })).map(user => [user.id, user.loyaltyPoints]));
    const before = await balances();
    const response = await Promise.all(customers.map(redeem));
    expect(response.map(result => result.status).sort()).toEqual([200, 400]);
    expect(response.find(result => result.status === 400)?.body.message).toBe('Voucher đổi thưởng đã hết lượt đổi');
    const after = await balances();
    customers.forEach((id, index) => {
      expect(after.get(id)).toBe(before.get(id)! - (response[index].status === 200 ? 10 : 0));
    });
    expect(await prisma.userVoucher.count({ where: { promotionId: promotion.id } })).toBe(1);
    expect((await overview()).body.rewards).not.toContainEqual(expect.objectContaining({ id: rewardItemId }));
    const soldOutList = (await api().get(route).set('Authorization', admin).expect(200)).body.data;
    expect(soldOutList).toContainEqual(expect.objectContaining({ id: promotion.id, redemptionLimit: 1, remainingCount: 0 }));
    const winnerId = customers[response.findIndex(result => result.status === 200)];
    const wallet = await api().get('/api/rewards').set('Authorization', bearer(winnerId)).expect(200);
    expect(wallet.body.vouchers).toContainEqual(expect.objectContaining({ code: lastVoucherCode, count: 1 }));

    await editLimit(2).expect(200);
    expect((await overview()).body.rewards).toContainEqual(expect.objectContaining({
      id: rewardItemId, redemptionLimit: 2, remainingCount: 1,
    }));
    await redeem(secondCustomerId).expect(200);
    await editLimit(1).expect(400);
    expect(await prisma.userVoucher.count({ where: { promotionId: promotion.id } })).toBe(2);
  });
});
