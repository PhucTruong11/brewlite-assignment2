import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Cron } from '@nestjs/schedule';
import { PayOS, type Webhook } from '@payos/node';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryState, PaymentMethod, OrderStatus, PaymentStatus, type Order, type Prisma } from '@prisma/client';
import { RewardsService } from '../rewards/rewards.service.js';
import { InventoryService, RESERVATION_DURATION_MS } from '../inventory/inventory.service.js';
import { PaymentGatewayService } from './payment-gateway.service.js';

// Thời hạn thanh toán cho mỗi đơn hàng: 2 phút (120,000 ms)
export const PAYMENT_TIMEOUT_MS = RESERVATION_DURATION_MS;
const PAYABLE_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED];
const PAYMENT_ITEMS = { items: { include: { product: true } } } satisfies Prisma.OrderInclude;
const PAYOS_LINK = { payosPaymentLink: true } satisfies Prisma.OrderInclude;
type PayosOrder = Prisma.OrderGetPayload<{ include: typeof PAYMENT_ITEMS & typeof PAYOS_LINK }>;

// ============================================================
// Danh mục mã giảm giá hợp lệ trong hệ thống.
// ============================================================
export interface VoucherRule {
  code: string;
  description: string;
  discountType: 'FIXED' | 'PERCENT';
  discountValue: number; // 15000 (VND) hoặc 10 (%)
  minOrderValue: number; // Giá trị đơn tối thiểu để dùng
  maxDiscount?: number;  // Mức giảm tối đa khi giảm theo phần trăm.
}

export const VALID_VOUCHERS: Record<string, VoucherRule> = {
  WELCOME10: {
    code: 'WELCOME10',
    description: 'Giảm 10% cho đơn hàng từ 30k',
    discountType: 'PERCENT',
    discountValue: 10,
    minOrderValue: 30000,
    maxDiscount: 15000,
  },
  COFFEE20K: {
    code: 'COFFEE20K',
    description: 'Giảm ngay 20.000đ cho đơn từ 40k',
    discountType: 'FIXED',
    discountValue: 20000,
    minOrderValue: 40000,
  },
  BREWLITE50: {
    code: 'BREWLITE50',
    description: 'Giảm 50% tối đa 30.000đ',
    discountType: 'PERCENT',
    discountValue: 50,
    minOrderValue: 50000,
    maxDiscount: 30000,
  },
  CHAOBAN: {
    code: 'CHAOBAN',
    description: 'Giảm 15.000đ cho đơn từ 40.000đ',
    discountType: 'FIXED',
    discountValue: 15000,
    minOrderValue: 40000,
  },
  BREW10: {
    code: 'BREW10',
    description: 'Giảm 10% (tối đa 25.000đ) cho mọi đơn',
    discountType: 'PERCENT',
    discountValue: 10,
    minOrderValue: 0,
    maxDiscount: 25000,
  },
  FREESHIP: {
    code: 'FREESHIP',
    description: 'Giảm 10.000đ cho đơn từ 30.000đ',
    discountType: 'FIXED',
    discountValue: 10000,
    minOrderValue: 30000,
  },
  TRIAN: {
    code: 'TRIAN',
    description: 'Tặng 1 ly nước miễn phí (giảm 100%)',
    discountType: 'PERCENT',
    discountValue: 100,
    minOrderValue: 0,
  },
};

// ============================================================
// Xử lý toàn bộ nghiệp vụ thanh toán.
// ============================================================
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly payos?: PayOS;
  private readonly payosChecks = new Map<string, { at: number; requiresReview: boolean }>();

  constructor(private readonly prisma: PrismaService,
    private readonly rewardsService: RewardsService,
    private readonly inventory: InventoryService,
    private readonly gateway: PaymentGatewayService,
  ) {
    const { PAYOS_CLIENT_ID: clientId, PAYOS_API_KEY: apiKey, PAYOS_CHECKSUM_KEY: checksumKey } = process.env;
    if (clientId && apiKey && checksumKey) {
      this.payos = new PayOS({ clientId, apiKey, checksumKey, timeout: 4000, maxRetries: 0, logLevel: 'off' });
    }
  }

  /** Đơn mới dùng hạn giữ nguyên liệu; đơn cũ dùng thời điểm tạo cộng hai phút. */
  private deadline(order: { createdAt: Date; reservationExpiresAt: Date | null }) {
    return order.reservationExpiresAt ?? new Date(order.createdAt.getTime() + PAYMENT_TIMEOUT_MS);
  }

  /** Khóa đơn rồi hủy và trả nguyên liệu đã giữ nếu đơn thực sự quá hạn. */
  private async cancelExpiredOrder(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { ...PAYMENT_ITEMS, ...PAYOS_LINK } });
      if (!order || (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAYMENT_FAILED)) return false;
      if (this.deadline(order).getTime() > Date.now()) return false;
      return this.expireLockedOrder(tx, order);
    }, { timeout: 15000 });
  }

  /** Chỉ hủy sau khi PayOS xác nhận chưa nhận tiền và link đã đóng. */
  private async expireLockedOrder(tx: Prisma.TransactionClient, order: PayosOrder) {
    if (order.payosPaymentLink) {
      const state = await this.reconcileLockedPayos(tx, order, true);
      if (state !== 'unpaid') return false;
    }
    await this.inventory.release(tx, order);
    await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
    return true;
  }

  private async reconcileLockedPayos(tx: Prisma.TransactionClient, order: PayosOrder, expire = false) {
    if (!this.payos || !order.payosPaymentLink) throw new ServiceUnavailableException('Chưa đối soát được PayOS');
    const id = order.payosPaymentLink.id;
    let remote = await this.payos.paymentRequests.get(id);
    if (remote.id !== id || remote.amount !== order.total) throw new ConflictException('Dữ liệu PayOS không khớp đơn hàng');
    if (expire && remote.status === 'PENDING' && remote.amountPaid === 0) {
      remote = await this.payos.paymentRequests.cancel(id, 'Hết thời gian thanh toán').catch(() => this.payos!.paymentRequests.get(id));
    }
    if (remote.id !== id || remote.amount !== order.total) throw new ConflictException('Dữ liệu PayOS không khớp đơn hàng');
    if (remote.status === 'PAID' && remote.amountPaid === order.total && remote.amountRemaining === 0) {
      if (!PAYABLE_STATUSES.includes(order.status) ||
        (order.inventoryState !== InventoryState.RESERVED && order.inventoryState !== InventoryState.LEGACY)) {
        this.logger.error(`PayOS đã nhận tiền nhưng đơn ${order.id} không còn giữ kho; cần đối soát thủ công`);
        return 'review' as const;
      }
      await this.completePayment(tx, order, PaymentMethod.EWALLET, `PAYOS-RECONCILE-${id}`);
      return 'paid' as const;
    }
    if (remote.amountPaid > 0) return 'review' as const;
    if (expire && !['CANCELLED', 'EXPIRED'].includes(remote.status)) throw new ConflictException('PayOS chưa xác nhận đóng link');
    return 'unpaid' as const;
  }

  private async reconcilePayosOrder(orderId: string) {
    const cached = this.payosChecks.get(orderId);
    if (cached && Date.now() - cached.at < 5000) return cached.requiresReview;
    const requiresReview = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { ...PAYMENT_ITEMS, ...PAYOS_LINK } });
      if (!order.payosPaymentLink || (!PAYABLE_STATUSES.includes(order.status) && order.status !== OrderStatus.CANCELLED)) return false;
      // Tránh nhiều tab hỏi cổng liên tiếp sau khi đã đợi khóa của cùng đơn.
      const latest = this.payosChecks.get(orderId);
      if (latest && Date.now() - latest.at < 5000) return latest.requiresReview;
      return (await this.reconcileLockedPayos(tx, order)) === 'review';
    }, { timeout: 10000 });
    if (this.payosChecks.size > 2000) this.payosChecks.clear();
    this.payosChecks.set(orderId, { at: Date.now(), requiresReview });
    return requiresReview;
  }

  /** Chỉ cho chủ đơn xem hoặc thao tác thanh toán trên đơn của mình. */
  private async findOwnedOrder(orderId: string, userId: string) {
    if (!userId) {
      throw new UnauthorizedException('Vui lòng đăng nhập để thanh toán');
    }
    const order = await this.prisma.order.findUnique({
      where: { id: orderId, userId },
      include: PAYOS_LINK,
    });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderId}`);
    }
    return order;
  }

  // ----------------------------------------------------------
  // Chỉ áp mã cho đơn đang chờ; tính lại tổng tiền từ giá trước khi giảm.
  // ----------------------------------------------------------
  async applyVoucher(orderId: string, promoCode: string, userId: string) {
    const order = await this.findOwnedOrder(orderId, userId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể áp dụng mã giảm giá khi đơn hàng đang chờ thanh toán',
      );
    }
    if (this.deadline(order).getTime() <= Date.now()) {
      await this.cancelExpiredOrder(orderId);
      const reconciled = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
      const payment = reconciled.payments.find(p => p.status === PaymentStatus.SUCCESS);
      if (payment && reconciled.status === OrderStatus.PAID) {
        return { isDuplicate: true, success: true, payment, pointsEarned: reconciled.loyaltyPointsEarned, message: 'PayOS đã xác nhận thanh toán' };
      }
      throw new BadRequestException(reconciled.status === OrderStatus.CANCELLED
        ? 'Đơn hàng đã hết hạn thanh toán' : 'Đang đối soát PayOS, chưa thể thanh toán lại');
    }

    const cleanCode = promoCode.trim().toUpperCase();
    // Người dùng phải sở hữu mã giảm giá đã đổi bằng điểm.
    await this.rewardsService.assertVoucherUsable(userId, cleanCode);

    // 1. Kiểm tra mã giảm giá trong cơ sở dữ liệu trước.
    const dbPromo = await this.prisma.promotion.findUnique({
      where: { code: cleanCode },
    });

    // 2. Dùng danh sách mã dự phòng nếu cơ sở dữ liệu chưa có.
    const fallbackRule = VALID_VOUCHERS[cleanCode];

    if (!dbPromo && !fallbackRule) {
      throw new BadRequestException(
        `Mã giảm giá "${promoCode}" không tồn tại hoặc đã hết hạn`,
      );
    }

    const now = new Date();
    if (dbPromo && (!dbPromo.isActive || dbPromo.startDate > now || (dbPromo.endDate && dbPromo.endDate <= now))) {
      throw new BadRequestException(
        `Mã giảm giá "${promoCode}" chưa có hiệu lực hoặc đã hết hạn`,
      );
    }

    // Giá trị đơn ban đầu (trước khi trừ giảm giá cũ nếu có)
    const baseTotal = order.total + order.discount;
    const minOrderValue = dbPromo ? dbPromo.minOrderValue : (fallbackRule?.minOrderValue ?? 0);

    if (baseTotal < minOrderValue) {
      throw new BadRequestException(
        `Đơn hàng cần đạt tối thiểu ${minOrderValue.toLocaleString('vi-VN')}đ để sử dụng mã "${cleanCode}".`,
      );
    }

    // Tính toán số tiền được giảm
    let discountAmount = 0;
    const description = dbPromo?.description || fallbackRule?.description || '';

    if (dbPromo) {
      if (dbPromo.discountType === 'PERCENTAGE') {
        discountAmount = Math.floor((baseTotal * dbPromo.discountValue) / 100);
        if (dbPromo.maxDiscount && discountAmount > dbPromo.maxDiscount) {
          discountAmount = dbPromo.maxDiscount;
        }
      } else {
        discountAmount = Math.floor(dbPromo.discountValue);
      }
    } else if (fallbackRule) {
      if (fallbackRule.discountType === 'FIXED') {
        discountAmount = fallbackRule.discountValue;
      } else {
        discountAmount = Math.floor((baseTotal * fallbackRule.discountValue) / 100);
        if (fallbackRule.maxDiscount && discountAmount > fallbackRule.maxDiscount) {
          discountAmount = fallbackRule.maxDiscount;
        }
      }
    }

    discountAmount = Math.min(discountAmount, baseTotal);
    const finalTotal = Math.max(0, baseTotal - discountAmount);

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
      const current = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: PAYOS_LINK });
      if (current.status !== OrderStatus.PENDING || this.deadline(current).getTime() <= Date.now()) {
        throw new ConflictException('Đơn hàng không còn chờ thanh toán');
      }
      if (current.payosPaymentLink) {
        throw new ConflictException('Mã ưu đãi phải được áp dụng trước khi tạo mã VietQR');
      }
      await tx.order.update({
        where: { id: orderId },
        data: { promoCode: cleanCode, discount: discountAmount, total: finalTotal },
      });
    });

    return {
      success: true,
      promoCode: cleanCode,
      description,
      discount: discountAmount,
      originalTotal: baseTotal,
      finalTotal,
      message: `Áp dụng thành công mã "${cleanCode}"! Bạn được giảm ${discountAmount.toLocaleString('vi-VN')}đ.`,
    };
  }

  // ----------------------------------------------------------
  // Thanh toán đơn đã tạo: kiểm tra quyền và thời hạn, chống xử lý trùng rồi khóa đơn.
  // Thành công thì trừ tồn thực và cộng điểm; thất bại vẫn giữ nguyên liệu để thử lại trong hạn.
  // ----------------------------------------------------------
  async processCheckout(
    orderId: string,
    method: PaymentMethod,
    idempotencyKey: string,
    userId: string,
    promoCode?: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException('Vui lòng đăng nhập để thanh toán');
    }
    // Xác minh chủ đơn trước khi đọc giao dịch, áp mã giảm giá hoặc gọi cổng thanh toán.
    const order = await this.prisma.order.findUnique({
      where: { id: orderId, userId },
      include: {
        user: true,
        items: {
          include: { product: true },
        },
      },
    });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id: ${orderId}`);
    }

    // ── Bước 1: Chặn xử lý lặp bằng mã giao dịch. ──
    const existingPayment = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });

    if (existingPayment) {
      if (existingPayment.orderId !== orderId) {
        throw new ConflictException('Idempotency-Key đã được sử dụng cho đơn hàng khác');
      }
      return {
        isDuplicate: true,
        payment: existingPayment,
        message: 'Thanh toán này đã được xử lý trước đó',
      };
    }

    if (this.deadline(order).getTime() <= Date.now() &&
      (order.status === OrderStatus.PENDING || order.status === OrderStatus.PAYMENT_FAILED)) {
      await this.cancelExpiredOrder(orderId);
      throw new BadRequestException('Đơn hàng đã hết hạn thanh toán');
    }

    // Kiểm tra mã giao dịch trước khi thay đổi mã giảm giá của đơn hàng.
    const cleanPromoCode = promoCode?.trim().toUpperCase();
    if (cleanPromoCode && order.promoCode?.toUpperCase() !== cleanPromoCode) {
      await this.applyVoucher(orderId, cleanPromoCode, userId);
    }

    // ── Bước 2b: Kiểm tra đơn hàng có sản phẩm hay không (Chặn đơn rỗng) ──
    if (!order.items || order.items.length === 0) {
      throw new BadRequestException('Đơn hàng không có sản phẩm nào để thanh toán');
    }

    // ── Bước 3: Kiểm tra trạng thái hợp lệ của đơn hàng. ──
    if (!PAYABLE_STATUSES.includes(order.status)) {
      const statusMessages: Record<string, string> = {
        PAID: 'Đơn hàng đã được thanh toán rồi',
        CANCELLED: 'Đơn hàng đã bị hủy hoặc hết hạn thanh toán, không thể thanh toán',
        PREPARING: 'Đơn hàng đang được pha chế',
        READY: 'Đơn hàng đã sẵn sàng',
        COMPLETED: 'Đơn hàng đã hoàn tất',
      };

      throw new BadRequestException(
        statusMessages[order.status] ??
        `Đơn hàng đang ở trạng thái ${order.status}, không thể thanh toán`,
      );
    }

    // ── Bước 4: Khóa dữ liệu để các yêu cầu đồng thời không xử lý trùng. ──
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      // Xử lý lần lượt các yêu cầu cùng mã giao dịch trước khi gọi cổng thanh toán.
      await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${idempotencyKey}))) AS payment_lock`;
      // Khóa dòng đơn hàng trong giao dịch bằng SELECT FOR UPDATE.
      // Ngăn hai yêu cầu đồng thời cùng xử lý một đơn hàng.
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;

      // Kiểm tra lại trạng thái sau khi khóa vì yêu cầu trước có thể vừa cập nhật đơn.
      const lockedOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { ...PAYMENT_ITEMS, ...PAYOS_LINK },
      });

      if (!lockedOrder || lockedOrder.userId !== userId) {
        throw new NotFoundException(`Không tìm thấy đơn hàng với id: ${orderId}`);
      }
      // Kiểm tra mã giao dịch lần nữa sau khi khóa để chặn hai yêu cầu đến cùng lúc.
      const paymentAfterLock = await tx.payment.findUnique({ where: { idempotencyKey } });
      if (paymentAfterLock) {
        if (paymentAfterLock.orderId !== orderId) {
          throw new ConflictException('Idempotency-Key đã được sử dụng cho đơn hàng khác');
        }
        return { duplicate: true as const, payment: paymentAfterLock };
      }
      if (!PAYABLE_STATUSES.includes(lockedOrder.status)) {
        throw new ConflictException('Đơn hàng đã được xử lý bởi một phiên giao dịch khác');
      }
      if (this.deadline(lockedOrder).getTime() <= Date.now()) {
        if (await this.expireLockedOrder(tx, lockedOrder)) return { expired: true as const };
        const payment = await tx.payment.findFirst({ where: { orderId, status: PaymentStatus.SUCCESS } });
        if (!payment) throw new ConflictException('Đang đối soát giao dịch PayOS. Chưa thể thanh toán lại.');
        return { expired: false as const, payment, success: true, pointsEarned: Math.floor(lockedOrder.total / 10000) };
      }

      if (!Number.isSafeInteger(lockedOrder.total) || lockedOrder.total < 0) {
        throw new BadRequestException('Số tiền thanh toán không hợp lệ');
      }

      if (lockedOrder.total > 0 && method === PaymentMethod.EWALLET) {
        throw new BadRequestException('Vui lòng thanh toán VietQR qua PayOS');
      }
      const success = lockedOrder.total === 0 || (await this.gateway.charge(lockedOrder.total, method)).success;
      if (success) {
        if (lockedOrder.payosPaymentLink) {
          await this.cancelPayosLink(lockedOrder.payosPaymentLink.id);
        }
        const { payment, pointsEarned } = await this.completePayment(tx, lockedOrder, method, idempotencyKey);
        return { expired: false as const, payment, success, pointsEarned };
      }

      const payment = await tx.payment.create({
        data: { orderId, idempotencyKey, amount: lockedOrder.total, method, status: PaymentStatus.FAILED },
      });
      await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.PAYMENT_FAILED } });
      return { expired: false as const, payment, success, pointsEarned: 0 };
    }, { timeout: 15000 });

    if (transactionResult.expired) {
      throw new BadRequestException('Đơn hàng đã hết hạn thanh toán và nguyên liệu đã được trả kho');
    }
    if ('duplicate' in transactionResult && transactionResult.duplicate) {
      return { isDuplicate: true, payment: transactionResult.payment, message: 'Thanh toán này đã được xử lý trước đó' };
    }

    // ── Bước 7: Trả về kết quả ──
    return {
      isDuplicate: false,
      success: transactionResult.success,
      payment: transactionResult.payment,
      pointsEarned: transactionResult.pointsEarned,
      message: transactionResult.success
        ? `Thanh toán thành công! Bạn được cộng ${transactionResult.pointsEarned} điểm thưởng.`
        : 'Thanh toán thất bại. Vui lòng thử lại hoặc chọn phương thức khác.',
    };
  }

  private async completePayment(
    tx: Prisma.TransactionClient,
    order: Prisma.OrderGetPayload<{ include: typeof PAYMENT_ITEMS }>,
    method: PaymentMethod,
    idempotencyKey: string,
  ) {
    if (order.inventoryState === InventoryState.RESERVED) {
      await this.inventory.consume(tx, order);
    } else if (order.inventoryState === InventoryState.LEGACY) {
      // Đơn được tạo trước khi chuyển sang kho nguyên liệu vẫn dùng tồn kho sản phẩm cũ.
      const stockItems = new Map<string, (typeof order.items)[number]>();
      for (const item of order.items) {
        if (!item.productId || !item.product) {
          throw new ConflictException('Sản phẩm của đơn cũ không còn trong danh mục');
        }
        const existing = stockItems.get(item.productId);
        stockItems.set(item.productId, existing ? { ...existing, qty: existing.qty + item.qty } : item);
      }
      for (const item of [...stockItems.values()].sort((a, b) => a.productId!.localeCompare(b.productId!))) {
        const changed = await tx.product.updateMany({
          where: { id: item.productId!, stock: { gte: item.qty }, version: item.product!.version },
          data: { stock: { decrement: item.qty }, version: { increment: 1 } },
        });
        if (changed.count === 0) throw new ConflictException(`Sản phẩm "${item.product!.name}" không còn đủ hàng`);
      }
    } else {
      throw new ConflictException('Nguyên liệu giữ cho đơn hàng này không còn hiệu lực');
    }

    const payment = await tx.payment.create({
      data: { orderId: order.id, idempotencyKey, amount: order.total, method, status: PaymentStatus.SUCCESS },
    });
    const pointsEarned = Math.floor(order.total / 10_000);
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID, loyaltyPointsEarned: pointsEarned },
    });
    await this.rewardsService.earnPoints(tx, order);
    await this.rewardsService.consumeVoucher(tx, order.userId, order.promoCode, order.id);
    return { payment, pointsEarned };
  }

  private async cancelPayosLink(linkId: string) {
    if (!this.payos) throw new ServiceUnavailableException('PayOS chưa được cấu hình');
    try {
      const requests = this.payos.paymentRequests;
      const result = await requests.cancel(linkId, 'Khách chọn thanh toán bằng thẻ').catch(() => requests.get(linkId));
      if ((result.status === 'CANCELLED' || result.status === 'EXPIRED') && result.amountPaid === 0) return;
    } catch {
      this.logger.warn(`Không thể hủy link PayOS ${linkId}`);
    }
    throw new ConflictException('Chưa thể đổi phương thức. Vui lòng kiểm tra giao dịch PayOS.');
  }

  // ----------------------------------------------------------
  // Lấy lịch sử thanh toán của một đơn hàng.
  // ----------------------------------------------------------
  async getCheckoutsByOrder(orderId: string, userId: string) {
    await this.findOwnedOrder(orderId, userId);
    return this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ----------------------------------------------------------
  // Lấy trạng thái và thời gian còn lại; nếu quá hạn thì hủy đơn và trả nguyên liệu.
  // ----------------------------------------------------------
  async getOrderCheckoutStatus(orderId: string, userId: string) {
    let order = await this.findOwnedOrder(orderId, userId);
    let payosError: string | undefined;
    let paymentReviewRequired = false;

    try {
      if (PAYABLE_STATUSES.includes(order.status) && this.deadline(order).getTime() <= Date.now()) {
        await this.cancelExpiredOrder(orderId);
      }
      order = await this.findOwnedOrder(orderId, userId);
      if (order.payosPaymentLink && (PAYABLE_STATUSES.includes(order.status) || order.status === OrderStatus.CANCELLED)) {
        paymentReviewRequired = await this.reconcilePayosOrder(orderId);
        order = await this.findOwnedOrder(orderId, userId);
      }
    } catch {
      this.logger.warn(`Chưa đối soát được PayOS cho đơn ${orderId}; không tự hủy hoặc trả kho`);
      payosError = 'Đang đối soát PayOS. Nếu bạn đã chuyển tiền, không chuyển lại hoặc tạo đơn khác.';
    }

    if (this.canCreatePayosLink(order) && !order.payosPaymentLink) {
      if (!this.payos) {
        payosError = 'Thanh toán PayOS chưa được cấu hình.';
      } else {
        try {
          order = await this.getOrCreatePayosLink(orderId, this.payos);
        } catch {
          this.logger.warn(`Không thể tạo mã PayOS cho đơn ${orderId}`);
          payosError = 'Chưa lấy được mã VietQR từ PayOS. Hệ thống sẽ thử lại.';
        }
      }
    }

    const expiresAt = this.deadline(order);
    const remainingSeconds = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
    const link = remainingSeconds > 0 && PAYABLE_STATUSES.includes(order.status) ? order.payosPaymentLink : null;
    const payments = await this.prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });

    return {
      orderId: order.id,
      status: order.status,
      originalTotal: order.total + order.discount,
      discount: order.discount,
      promoCode: order.promoCode,
      total: order.total,
      qrCodeUrl: link?.qrCodeUrl ?? '',
      checkoutUrl: link?.checkoutUrl,
      payosError,
      paymentReviewRequired,
      bankInfo: link ? {
        bankBin: link.bankBin,
        accountNo: link.accountNo,
        accountName: link.accountName,
        transferContent: link.transferContent,
      } : undefined,
      createdAt: order.createdAt,
      expiresAt,
      remainingSeconds,
      isExpired: remainingSeconds === 0,
      payments,
    };
  }

  private canCreatePayosLink(order: Order) {
    return order.total > 0 && PAYABLE_STATUSES.includes(order.status) && this.deadline(order).getTime() > Date.now();
  }

  private async getOrCreatePayosLink(orderId: string, payos: PayOS) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: PAYOS_LINK });
      if (order.payosPaymentLink || !this.canCreatePayosLink(order)) return order;

      const checkoutPage = new URL('/checkout', process.env.FRONTEND_URL || 'http://localhost:3000');
      checkoutPage.searchParams.set('orderId', orderId);
      const link = await payos.paymentRequests.create({
        orderCode: randomInt(1_000_000_000, 2_147_483_647),
        amount: order.total,
        description: `BL${orderId.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
        returnUrl: checkoutPage.href,
        cancelUrl: checkoutPage.href,
        expiredAt: Math.floor(this.deadline(order).getTime() / 1000),
      });
      if (link.status !== 'PENDING' || link.amount !== order.total || !link.paymentLinkId || !link.qrCode) {
        throw new Error('Dữ liệu link thanh toán PayOS không hợp lệ');
      }

      const payosPaymentLink = await tx.payosPaymentLink.create({
        data: {
          id: link.paymentLinkId,
          orderId,
          checkoutUrl: link.checkoutUrl,
          qrCodeUrl: await QRCode.toDataURL(link.qrCode, { margin: 2, width: 320 }),
          bankBin: link.bin,
          accountNo: link.accountNumber,
          accountName: link.accountName,
          transferContent: link.description,
        },
      });
      return { ...order, payosPaymentLink };
    }, { timeout: 8000 });
  }

  async processPayosWebhook(body: Webhook) {
    if (!this.payos) throw new ServiceUnavailableException('PayOS chưa được cấu hình');

    let data;
    try {
      data = await this.payos.webhooks.verify(body);
    } catch {
      throw new BadRequestException('Chữ ký webhook PayOS không hợp lệ');
    }

    if (body.success !== true || body.code !== '00' || data.code !== '00' || data.currency !== 'VND' || !data.reference) {
      return { success: true };
    }

    const link = await this.prisma.payosPaymentLink.findUnique({ where: { id: data.paymentLinkId } });
    // PayOS dùng dữ liệu mẫu có chữ ký để xác minh URL webhook.
    if (!link) return { success: true };
    const idempotencyKey = `PAYOS-${link.id}-${data.reference}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${link.orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: link.orderId }, include: PAYMENT_ITEMS });
      if (!order) return;

      const paid = await tx.payment.findFirst({ where: { orderId: order.id, status: PaymentStatus.SUCCESS } });
      if (paid?.idempotencyKey === idempotencyKey) return;

      if (paid || !PAYABLE_STATUSES.includes(order.status) || data.amount !== order.total || data.amount <= 0) {
        this.logger.warn(`Cần đối soát giao dịch PayOS cho đơn ${order.id}, link ${link.id}`);
        return;
      }
      await this.completePayment(tx, order, PaymentMethod.EWALLET, idempotencyKey);
    });
    return { success: true };
  }

  // ----------------------------------------------------------
  // Tác vụ chạy mỗi 30 giây để hủy đơn quá hạn và trả nguyên liệu đã giữ.
  // Tác vụ vẫn chạy khi khách đã đóng trình duyệt.
  // ----------------------------------------------------------
  @Cron('*/30 * * * * *')
  async handleExpiredOrders() {
    const now = new Date();
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED] },
        OR: [
          { reservationExpiresAt: { lte: now } },
          { reservationExpiresAt: null, createdAt: { lte: new Date(now.getTime() - PAYMENT_TIMEOUT_MS) } },
        ],
      },
      select: { id: true },
      take: 100,
    });
    let cancelled = 0;
    for (const order of expiredOrders) {
      try {
        if (await this.cancelExpiredOrder(order.id)) cancelled++;
      } catch {
        this.logger.warn(`Chưa đối soát được đơn ${order.id}; giữ nguyên đơn và nguyên liệu`);
      }
    }
    if (cancelled > 0) {
      this.logger.warn(
        `Đã hủy ${cancelled} đơn hàng hết hạn và trả nguyên liệu đã giữ`,
      );
    }
  }
}
