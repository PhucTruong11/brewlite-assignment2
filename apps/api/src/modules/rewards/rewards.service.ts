import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PointTransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

// 10.000đ = 1 điểm, làm tròn xuống
export const VND_PER_POINT = 10_000;
export const VOUCHER_UNAVAILABLE_MESSAGE =
  'Voucher đổi điểm không còn lượt khả dụng. Vui lòng kiểm tra các đơn đang chờ hoặc chọn mã khác.';

export class RewardVoucherUnavailableException extends ConflictException {
  constructor() {
    super(VOUCHER_UNAVAILABLE_MESSAGE);
  }
}

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  calcPoints(total: number): number {
    return Math.floor(total / VND_PER_POINT);
  }

  // ---------------- GET /rewards ----------------
  async getOverview(userId: string) {
    const now = new Date();
    const usablePromotion = {
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gt: now } }],
    };
    const [user, rewardItems, unusedVouchers, history] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { loyaltyPoints: true },
      }),
      this.prisma.rewardItem.findMany({
        where: { isActive: true, promotion: { is: { ...usablePromotion, isRewardOnly: true } } },
        include: { promotion: { include: { _count: { select: { userVouchers: true } } } } },
        orderBy: { pointsCost: 'asc' },
      }),
      this.prisma.userVoucher.findMany({
        where: { userId, usedAt: null, reservedOrderId: null, promotion: { is: usablePromotion } },
        include: { promotion: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.pointTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    // Gộp voucher chưa dùng theo mã: REWARD10K x3
    const grouped = new Map<string, {
      code: string;
      description: string | null;
      count: number;
      discountType: string;
      discountValue: number;
      minOrderValue: number;
      maxDiscount: number | null;
      endDate: Date | null;
    }>();
    for (const v of unusedVouchers) {
      const cur = grouped.get(v.promotion.code);
      if (cur) cur.count += 1;
      else
        grouped.set(v.promotion.code, {
          code: v.promotion.code,
          description: v.promotion.description,
          count: 1,
          discountType: v.promotion.discountType,
          discountValue: v.promotion.discountValue,
          minOrderValue: v.promotion.minOrderValue,
          maxDiscount: v.promotion.maxDiscount,
          endDate: v.promotion.endDate,
        });
    }

    return {
      points: user.loyaltyPoints,
      rewards: rewardItems.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        pointsCost: r.pointsCost,
        code: r.promotion.code,
        endDate: r.promotion.endDate,
        redemptionLimit: r.promotion.redemptionLimit,
        remainingCount: r.promotion.redemptionLimit === null
          ? null
          : Math.max(0, r.promotion.redemptionLimit - r.promotion._count.userVouchers),
      })).filter(reward => reward.remainingCount === null || reward.remainingCount > 0),
      vouchers: [...grouped.values()],
      history,
    };
  }

  // ---------------- POST /rewards/redeem ----------------
  // Trừ điểm + tạo voucher + ghi lịch sử trong CÙNG 1 transaction
  async redeem(userId: string, rewardItemId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Khóa theo mã voucher để admin và các lượt đổi đồng thời dùng cùng một giới hạn.
      await tx.$queryRaw`
        SELECT p."id" FROM "promotions" p
        JOIN "reward_items" r ON r."promotionId" = p."id"
        WHERE r."id" = ${rewardItemId} FOR UPDATE OF p
      `;
      const reward = await tx.rewardItem.findFirst({
        where: { id: rewardItemId, isActive: true },
        include: { promotion: true },
      });
      const now = new Date();
      if (!reward || !reward.promotion.isRewardOnly || !reward.promotion.isActive ||
          reward.promotion.startDate > now || (reward.promotion.endDate && reward.promotion.endDate <= now)) {
        throw new NotFoundException('Phần quà không tồn tại, chưa có hiệu lực hoặc đã hết hạn');
      }
      const { redemptionLimit } = reward.promotion;
      if (redemptionLimit !== null) {
        const issued = await tx.userVoucher.count({ where: { promotionId: reward.promotionId } });
        if (issued >= redemptionLimit) throw new BadRequestException('Voucher đổi thưởng đã hết lượt đổi');
      }

      // Trừ điểm nguyên tử: chỉ thành công nếu còn đủ điểm (chống âm điểm khi bấm/đổi đồng thời)
      const deducted = await tx.user.updateMany({
        where: { id: userId, loyaltyPoints: { gte: reward.pointsCost } },
        data: { loyaltyPoints: { decrement: reward.pointsCost } },
      });
      if (deducted.count === 0) {
        throw new BadRequestException('Số điểm của bạn chưa đủ để đổi voucher này');
      }

      const voucher = await tx.userVoucher.create({
        data: { userId, promotionId: reward.promotionId, rewardItemId: reward.id },
      });

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { loyaltyPoints: true },
      });

      await tx.pointTransaction.create({
        data: {
          userId,
          type: PointTransactionType.REDEEM,
          points: -reward.pointsCost,
          balanceAfter: updatedUser.loyaltyPoints,
          userVoucherId: voucher.id,
        },
      });

      return {
        message: `Đổi thành công mã ${reward.promotion.code}! Nhập mã này ở trang thanh toán để sử dụng.`,
        points: updatedUser.loyaltyPoints,
        code: reward.promotion.code,
      };
    });
  }

  // ---------------- Dùng trong CheckoutService (cộng điểm) ----------------
  // Gọi BÊN TRONG transaction thanh toán thành công. Unique (orderId, EARN) chặn cộng trùng.
  async earnPoints(
    tx: Prisma.TransactionClient,
    order: { id: string; userId: string; total: number },
  ): Promise<number> {
    const points = this.calcPoints(order.total);
    if (points <= 0) return 0;

    const user = await tx.user.update({
      where: { id: order.userId },
      data: { loyaltyPoints: { increment: points } },
      select: { loyaltyPoints: true },
    });

    await tx.pointTransaction.create({
      data: {
        userId: order.userId,
        type: PointTransactionType.EARN,
        points,
        balanceAfter: user.loyaltyPoints,
        orderId: order.id,
      },
    });
    return points;
  }

  // ---------------- Kiểm tra quyền dùng voucher (gọi lúc tạo đơn / áp mã) ----------------
  // Mã thường: bỏ qua. Mã reward-only: user phải có ít nhất 1 voucher chưa dùng.
  async assertVoucherUsable(userId: string, code: string): Promise<void> {
    const promo = await this.prisma.promotion.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!promo || !promo.isRewardOnly) return;

    const available = await this.prisma.userVoucher.count({
      where: { userId, promotionId: promo.id, usedAt: null, reservedOrderId: null },
    });
    if (available === 0) {
      const held = await this.prisma.userVoucher.count({
        where: { userId, promotionId: promo.id, reservedOrderId: { not: null } },
      });
      if (held > 0) throw new RewardVoucherUnavailableException();
      throw new BadRequestException('Bạn không còn voucher này. Hãy đổi điểm tại trang Tích điểm để nhận mã.');
    }
  }

  // Giữ một lượt cho đơn đang khóa. PostgreSQL kiểm tra lại điều kiện sau khi đợi khóa
  // của đơn khác, nên mỗi lượt chỉ có thể được gắn vào một đơn.
  async reserveVoucher(
    tx: Prisma.TransactionClient,
    order: { id: string; userId: string; promoCode: string | null },
  ): Promise<string | null> {
    if (!order.promoCode) return null;

    const existing = await tx.userVoucher.findUnique({
      where: { reservedOrderId: order.id },
      select: { id: true },
    });
    if (existing) return existing.id;

    const promo = await tx.promotion.findUnique({
      where: { code: order.promoCode.trim().toUpperCase() },
      select: { id: true, isRewardOnly: true },
    });
    if (!promo?.isRewardOnly) return null;

    const [voucher] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "user_vouchers"
      WHERE "userId" = ${order.userId} AND "promotionId" = ${promo.id}
        AND "usedAt" IS NULL AND "usedOrderId" IS NULL AND "reservedOrderId" IS NULL
      ORDER BY "createdAt", "id" LIMIT 1 FOR UPDATE
    `;
    if (!voucher) throw new RewardVoucherUnavailableException();
    await tx.userVoucher.update({
      where: { id: voucher.id },
      data: { reservedOrderId: order.id },
    });
    return voucher.id;
  }

  async consumeVoucher(
    tx: Prisma.TransactionClient,
    order: { id: string; userId: string; promoCode: string | null },
  ): Promise<void> {
    const id = await this.reserveVoucher(tx, order);
    if (!id) return;
    await tx.userVoucher.update({
      where: { id },
      data: { reservedOrderId: null, usedAt: new Date(), usedOrderId: order.id },
    });
  }

  // Link sinh trước migration có thể không còn voucher để giữ.
  async hasRequiredVoucherHold(orderId: string, promoCode: string | null): Promise<boolean> {
    if (!promoCode) return true;
    const promo = await this.prisma.promotion.findUnique({
      where: { code: promoCode.trim().toUpperCase() },
      select: {
        isRewardOnly: true,
        userVouchers: { where: { reservedOrderId: orderId }, select: { id: true } },
      },
    });
    return !promo?.isRewardOnly || promo.userVouchers.length > 0;
  }

  async releaseVoucher(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    await tx.userVoucher.updateMany({
      where: { reservedOrderId: orderId },
      data: { reservedOrderId: null },
    });
  }
}
