import { NotFoundException } from '@nestjs/common';
import { RewardsService } from './rewards.service.js';

describe('RewardsService và hạn voucher', () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    rewardItem: { findMany: vi.fn(), findFirst: vi.fn() },
    userVoucher: { findMany: vi.fn() },
    pointTransaction: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const service = new RewardsService(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T04:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('chỉ tải quà và voucher có promotion còn hiệu lực', async () => {
    prisma.user.findUnique.mockResolvedValue({ loyaltyPoints: 20 });
    prisma.rewardItem.findMany.mockResolvedValue([]);
    prisma.userVoucher.findMany.mockResolvedValue([]);
    prisma.pointTransaction.findMany.mockResolvedValue([]);

    await service.getOverview('u1');

    const activePromotion = expect.objectContaining({
      isActive: true,
      startDate: { lte: new Date() },
      OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
    });
    expect(prisma.rewardItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ promotion: { is: activePromotion } }),
    }));
    expect(prisma.userVoucher.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ promotion: { is: activePromotion } }),
    }));
  });

  it('không trừ điểm nếu quà vừa hết hạn', async () => {
    prisma.rewardItem.findFirst.mockResolvedValue({
      isActive: true,
      promotion: {
        isActive: true,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date(),
      },
    });
    await expect(service.redeem('u1', 'r1')).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
