import { PrismaClient } from '@prisma/client';

// Chỉ nạp tồn kho mẫu cho máy phát triển; không ghi đè nguyên liệu đang có số dư khác 0.
const demoStock: Record<string, number> = {
  COFFEE_BEANS: 10_000,
  SUGAR: 10_000,
  CONDENSED_MILK: 10_000,
  FRESH_MILK: 10_000,
  CARAMEL_SYRUP: 2_000,
  BREWED_TEA: 10_000,
  PEACH_SYRUP: 2_000,
  LEMONGRASS: 1_000,
  ICE: 20_000,
  CUP_S: 100,
  CUP_M: 100,
  CUP_L: 100,
  STRAW: 300,
  WHITE_PEARLS: 2_000,
  COFFEE_JELLY: 2_000,
  SALTED_CREAM: 2_000,
};

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', 'db'].includes(url.hostname)) {
    throw new Error('Chỉ nạp tồn kho mẫu vào PostgreSQL chạy trên máy phát triển');
  }
  const prisma = new PrismaClient();
  try {
    const current = await prisma.ingredient.findMany({ select: { code: true } });
    const expected = new Set(Object.keys(demoStock));
    if (current.filter((row) => expected.has(row.code)).length !== expected.size) {
      throw new Error('Thiếu nguyên liệu; chạy catalog:bootstrap trước khi nạp tồn kho mẫu');
    }
    for (const [code, quantity] of Object.entries(demoStock)) {
      const updated = await prisma.ingredient.updateMany({
        where: { code, trackStock: true, onHand: 0, reserved: 0 },
        data: { onHand: quantity, version: { increment: 1 } },
      });
      console.log(`${code}: ${updated.count ? `nạp ${quantity}` : 'giữ nguyên tồn kho hiện tại'}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
