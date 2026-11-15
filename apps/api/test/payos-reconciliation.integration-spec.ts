import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PayOS, PaymentRequests, type WebhookData } from '@payos/node';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';
import { CheckoutService } from '../src/modules/checkout/checkout.service.js';
import { AdminService } from '../src/modules/admin/admin.service.js';

describe('PayOS đối soát khi webhook chậm/mất', () => {
  let app: INestApplication, db: PrismaService, token: string;
  const userId = randomUUID(), ingredientId = randomUUID(), productId = randomUUID();
  const key = 'reconciliation-test-checksum';
  const rewardCode = 'QR' + userId.slice(0, 8).toUpperCase();
  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: 'Bearer ' + token });
  const createOrder = async (promoCode?: string) => {
    const result = await api().post('/api/orders').set(auth())
      .send({ items: [{ productId, size: 'S', qty: 1, lineTotal: 1 }], promoCode })
      .expect(201);
    return result.body.data.id as string;
  };
  const create = async (promoCode?: string) => {
    const id = await createOrder(promoCode);
    const link = await db.payosPaymentLink.create({ data: { id: randomUUID(), orderId: id, checkoutUrl: 'https://pay.payos.vn/test', qrCodeUrl: 'test', bankBin: '970416', accountNo: 'test', accountName: 'TEST', transferContent: 'BLTEST' } });
    return { id, link };
  };
  const status = (id: string) => api().get('/api/checkout/status/' + id).set(auth()).expect(200);
  const expired = (id: string) => db.order.update({ where: { id }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
  const remote = (id: string, state = 'PAID', amountPaid = 29000) => ({ id, amount: 29000, amountPaid, amountRemaining: 29000 - amountPaid, status: state });
  const mockGet = (value: ReturnType<typeof remote>) => vi.spyOn(PaymentRequests.prototype, 'get').mockResolvedValue(value as never);

  const issueRewardVoucher = async () => {
    const promotion = await db.promotion.create({
      data: { code: rewardCode, discountType: 'FIXED_AMOUNT', discountValue: 10_000, isRewardOnly: true,
        rewardItems: { create: { name: 'QR voucher fixture', pointsCost: 1 } } },
      include: { rewardItems: true },
    });
    return db.userVoucher.create({
      data: { userId, promotionId: promotion.id, rewardItemId: promotion.rewardItems[0].id },
    });
  };
  const mockCreateLink = () => vi.spyOn(PaymentRequests.prototype, 'create').mockImplementation(async input => ({
    ...input, paymentLinkId: randomUUID(), checkoutUrl: 'https://pay.payos.vn/test', qrCode: 'VietQR fixture',
    status: 'PENDING', bin: '970416', accountNumber: '1234567890', accountName: 'BREWLITE TEST', currency: 'VND',
  }));
  const voucherState = (id: string) => db.userVoucher.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid');
    if (process.env.E2E_DATABASE !== '1' || url.pathname !== '/brewlite_test' || !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('DB test local only');
    vi.stubEnv('PAYOS_CLIENT_ID', 'test-client'); vi.stubEnv('PAYOS_API_KEY', 'test-api'); vi.stubEnv('PAYOS_CHECKSUM_KEY', key);
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })); await app.init();
    db = app.get(PrismaService);
    await db.user.create({ data: { id: userId, email: userId + '@example.test', passwordHash: 'test-only', emailVerifiedAt: new Date() } });
    await db.ingredient.create({ data: { id: ingredientId, code: 'RECON_' + ingredientId, name: 'Reconcile fixture', unit: 'G', onHand: 100, reserved: 0 } });
    await db.product.create({ data: { id: productId, name: 'Reconcile fixture', category: 'other', prices: { create: { size: 'S', price: 29000 } } } });
    await db.recipe.create({ data: { productId, size: 'S', ingredientId, quantity: 5 } });
    token = new JwtService({ secret: process.env.JWT_SECRET || 'super-secret-key' }).sign({ sub: userId });
  }, 30000);
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.userVoucher.deleteMany({ where: { userId } });
    await db.rewardItem.deleteMany({ where: { promotion: { code: rewardCode } } });
    await db.promotion.deleteMany({ where: { code: rewardCode } });
    await db.pointTransaction.deleteMany({ where: { userId } }); await db.payment.deleteMany({ where: { order: { userId } } });
    await db.order.deleteMany({ where: { userId } });
    await db.ingredient.update({ where: { id: ingredientId }, data: { onHand: 100, reserved: 0 } });
  });
  afterAll(async () => {
    await db.recipe.deleteMany({ where: { ingredientId } }); await db.product.delete({ where: { id: productId } });
    await db.ingredient.delete({ where: { id: ingredientId } }); await db.user.delete({ where: { id: userId } });
    await app.close(); vi.unstubAllEnvs();
  });

  it('polling thấy PayOS đã trả đủ tiền khi không có webhook: PAID, một giao dịch, một lần trừ kho/cộng điểm', async () => {
    const { id, link } = await create(); const lookup = mockGet(remote(link.id));
    const responses = await Promise.all([status(id), status(id), status(id)]);
    expect(responses.every(r => r.body.status === 'PAID')).toBe(true);
    expect(responses[0].body.payments).toHaveLength(1);
    expect(await db.pointTransaction.count({ where: { orderId: id } })).toBe(1);
    expect(Number((await db.ingredient.findUniqueOrThrow({ where: { id: ingredientId } })).onHand)).toBe(95);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
  it('hết 2 phút nhưng PayOS đã PAID thì hoàn tất, không cancel/trả kho', async () => {
    const { id, link } = await create(); await expired(id); mockGet(remote(link.id));
    const cancel = vi.spyOn(PaymentRequests.prototype, 'cancel');
    await app.get(CheckoutService).handleExpiredOrders();
    expect((await status(id)).body.status).toBe('PAID'); expect(cancel).not.toHaveBeenCalled();
    expect((await db.order.findUniqueOrThrow({ where: { id } })).inventoryState).toBe('CONSUMED');
  });
  it('PayOS timeout lúc hết hạn: giữ nguyên đơn và kho, không tuyên bố đơn đã hủy', async () => {
    const { id } = await create(); await expired(id);
    vi.spyOn(PaymentRequests.prototype, 'get').mockRejectedValue(new Error('timeout'));
    await app.get(CheckoutService).handleExpiredOrders();
    const response = await status(id);
    expect(response.body.status).toBe('PENDING'); expect(response.body.payosError).toContain('Đang đối soát');
    expect(Number((await db.ingredient.findUniqueOrThrow({ where: { id: ingredientId } })).reserved)).toBe(5);
  });
  it('chưa nhận tiền và PayOS hủy link thành công mới CANCELLED và trả kho', async () => {
    const { id, link } = await create(); await expired(id); mockGet(remote(link.id, 'PENDING', 0));
    const cancel = vi.spyOn(PaymentRequests.prototype, 'cancel').mockResolvedValue(remote(link.id, 'CANCELLED', 0) as never);
    expect((await status(id)).body.status).toBe('CANCELLED'); expect(cancel).toHaveBeenCalledOnce();
    const stock = await db.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
    expect(Number(stock.onHand)).toBe(100); expect(Number(stock.reserved)).toBe(0);
  });
  it('nhận tiền đúng lúc cancel link: đọc trạng thái PAID, không làm mất giao dịch', async () => {
    const { id, link } = await create(); await expired(id); mockGet(remote(link.id, 'PENDING', 0));
    vi.spyOn(PaymentRequests.prototype, 'cancel').mockResolvedValue(remote(link.id) as never);
    expect((await status(id)).body.status).toBe('PAID');
  });
  it('nhận thiếu tiền hoặc dữ liệu không khớp không tự PAID/cancel', async () => {
    const { id, link } = await create(); await expired(id); const lookup = mockGet(remote(link.id, 'PENDING', 10000));
    const response = await status(id); expect(response.body.paymentReviewRequired).toBe(true); expect(response.body.status).toBe('PENDING');
    lookup.mockResolvedValue(remote('wrong-id') as never);
    await app.get(CheckoutService).handleExpiredOrders();
    expect((await db.order.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
    expect(await db.payment.count({ where: { orderId: id } })).toBe(0);
  });
  it('đơn cũ đã CANCELLED/RELEASED nhưng PayOS PAID: báo cần đối soát, không tự khôi phục/trừ kho', async () => {
    const { id, link } = await create(); mockGet(remote(link.id));
    await db.order.update({ where: { id }, data: { status: 'CANCELLED', inventoryState: 'RELEASED' } });
    await db.ingredient.update({ where: { id: ingredientId }, data: { reserved: 0 } });
    const response = await status(id); expect(response.body.status).toBe('CANCELLED'); expect(response.body.paymentReviewRequired).toBe(true);
    expect(await db.payment.count({ where: { orderId: id } })).toBe(0);
  });
  it('polling và webhook có chữ ký đến cùng lúc không trừ kho/cộng điểm hai lần', async () => {
    const { id, link } = await create(); mockGet(remote(link.id));
    const payos = new PayOS({ clientId: 'test', apiKey: 'test', checksumKey: key });
    const data: WebhookData = { orderCode: 123, amount: 29000, description: 'BLTEST', accountNumber: 'test', reference: randomUUID(), transactionDateTime: new Date().toISOString(), currency: 'VND', paymentLinkId: link.id, code: '00', desc: 'Success' };
    const signature = await payos.crypto.createSignatureFromObj(data, key);
    await Promise.all([status(id), api().post('/api/payments/payos-webhook').send({ code: '00', success: true, data, signature }).expect(200)]);
    expect(await db.payment.count({ where: { orderId: id, status: 'SUCCESS' } })).toBe(1);
    expect(await db.pointTransaction.count({ where: { orderId: id } })).toBe(1);
  });

  it('hai đơn cùng một voucher chỉ nhận một QR; webhook lặp tiêu đúng lượt đã giữ', async () => {
    const voucher = await issueRewardVoucher();
    const orders = await Promise.all([createOrder(rewardCode), createOrder(rewardCode)]);
    const gateway = mockCreateLink();
    const results = await Promise.all(orders.map(status));
    expect(gateway).toHaveBeenCalledOnce();
    expect(results.filter(response => response.body.qrCodeUrl)).toHaveLength(1);
    const winner = results.find(response => response.body.qrCodeUrl)!.body.orderId as string;
    const loser = results.find(response => !response.body.qrCodeUrl)!.body;
    expect(loser.payosError).toContain('Voucher đổi điểm không còn lượt khả dụng');
    expect(await voucherState(voucher.id)).toMatchObject({ reservedOrderId: winner, usedAt: null });

    await api().post('/api/checkout').set(auth()).set('Idempotency-Key', randomUUID())
      .send({ orderId: loser.orderId, method: 'CARD' }).expect(409);
    expect(await db.payment.count({ where: { orderId: loser.orderId } })).toBe(0);

    const link = await db.payosPaymentLink.findUniqueOrThrow({ where: { orderId: winner } });
    const input = gateway.mock.calls[0][0];
    const payos = new PayOS({ clientId: 'test', apiKey: 'test', checksumKey: key });
    const data: WebhookData = {
      orderCode: input.orderCode, amount: 19_000, description: input.description, accountNumber: '1234567890',
      reference: randomUUID(), transactionDateTime: new Date().toISOString(), currency: 'VND',
      paymentLinkId: link.id, code: '00', desc: 'Success',
    };
    const signature = await payos.crypto.createSignatureFromObj(data, key);
    const send = () => api().post('/api/payments/payos-webhook').send({ code: '00', success: true, data, signature }).expect(200);
    await Promise.all([send(), send()]);
    expect(await voucherState(voucher.id)).toMatchObject({ reservedOrderId: null, usedOrderId: winner, usedAt: expect.any(Date) });
    expect(await db.payment.count({ where: { orderId: winner, status: 'SUCCESS' } })).toBe(1);
    expect(await db.pointTransaction.count({ where: { orderId: winner, type: 'EARN' } })).toBe(1);
  });

  it('PayOS timeout giữ voucher, link đóng chưa có tiền thì voucher dùng được cho đơn khác', async () => {
    const voucher = await issueRewardVoucher();
    const first = await createOrder(rewardCode);
    const second = await createOrder(rewardCode);
    const gateway = mockCreateLink();
    await status(first);
    const link = await db.payosPaymentLink.findUniqueOrThrow({ where: { orderId: first } });
    await expect(app.get(AdminService).updateStatus(first, 'CANCELLED')).rejects.toThrow('đang chờ PayOS đối soát');
    await expired(first);
    const lookup = vi.spyOn(PaymentRequests.prototype, 'get').mockRejectedValue(new Error('timeout'));
    expect((await status(first)).body.status).toBe('PENDING');
    expect(await voucherState(voucher.id)).toMatchObject({ reservedOrderId: first, usedAt: null });
    expect((await status(second)).body.qrCodeUrl).toBe('');

    lookup.mockResolvedValue({ id: link.id, amount: 19_000, amountPaid: 0, amountRemaining: 19_000, status: 'PENDING' } as never);
    const cancel = vi.spyOn(PaymentRequests.prototype, 'cancel').mockResolvedValue({
      id: link.id, amount: 19_000, amountPaid: 0, amountRemaining: 19_000, status: 'CANCELLED',
    } as never);
    expect((await status(first)).body.status).toBe('CANCELLED');
    expect(cancel).toHaveBeenCalledOnce();
    expect(await voucherState(voucher.id)).toMatchObject({ reservedOrderId: null, usedAt: null });
    expect((await status(second)).body.qrCodeUrl).toMatch(/^data:image/);
    expect(gateway).toHaveBeenCalledTimes(2);
    expect(await voucherState(voucher.id)).toMatchObject({ reservedOrderId: second, usedAt: null });
  });

  it('PayOS không tạo được link thì giao dịch trả lại lượt giữ voucher', async () => {
    const voucher = await issueRewardVoucher();
    const first = await createOrder(rewardCode);
    const second = await createOrder(rewardCode);
    const gateway = mockCreateLink().mockRejectedValueOnce(new Error('PayOS unavailable'));
    expect((await status(first)).body.qrCodeUrl).toBe('');
    expect(await voucherState(voucher.id)).toMatchObject({ reservedOrderId: null, usedAt: null });
    expect((await status(second)).body.qrCodeUrl).toMatch(/^data:image/);
    expect(gateway).toHaveBeenCalledTimes(2);
  });

  it('link cũ đã nhận tiền nhưng không còn voucher được báo đối soát, không trả kho', async () => {
    const voucher = await issueRewardVoucher();
    const { id, link } = await create(rewardCode);
    await db.userVoucher.delete({ where: { id: voucher.id } });
    const lookup = vi.spyOn(PaymentRequests.prototype, 'get').mockResolvedValue({
      id: link.id, amount: 19_000, amountPaid: 0, amountRemaining: 19_000, status: 'PENDING',
    } as never);
    expect((await status(id)).body).toMatchObject({
      status: 'PENDING', qrCodeUrl: '', payosError: expect.stringContaining('Voucher đổi điểm không còn lượt khả dụng'),
    });
    await expired(id);
    lookup.mockResolvedValue({
      id: link.id, amount: 19_000, amountPaid: 19_000, amountRemaining: 0, status: 'PAID',
    } as never);

    const response = await status(id);
    expect(response.body).toMatchObject({ status: 'PENDING', paymentReviewRequired: true, qrCodeUrl: '' });
    expect(await db.payment.count({ where: { orderId: id } })).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id } })).inventoryState).toBe('RESERVED');
  });
});
