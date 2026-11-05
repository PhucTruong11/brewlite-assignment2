import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private async withIngredientAvailability<T extends { id: string; prices: { size: string }[] }>(products: T[]) {
    if (!products.length) return [];
    const recipes = await this.prisma.recipe.findMany({
      where: { productId: { in: products.map((product) => product.id) } },
      include: { ingredient: true },
    });
    return products.map((product) => {
      const stockBySize: Record<string, number> = {};
      for (const price of product.prices) {
        const entries = recipes.filter((entry) => entry.productId === product.id && entry.size === price.size);
        stockBySize[price.size] = entries.length === 0 || entries.some((entry) => !entry.ingredient.isActive) ? 0 : Math.max(0, Math.min(
          1_000_000,
          ...entries.filter((entry) => entry.ingredient.trackStock).map((entry) => {
            if (!entry.ingredient.isActive) return 0;
            const available = (entry.ingredient.onHand ?? new Prisma.Decimal(0))
              .sub(entry.ingredient.reserved ?? new Prisma.Decimal(0));
            return Math.max(0, available.div(entry.quantity).floor().toNumber());
          }),
        ));
      }
      return { ...product, stock: Math.max(0, ...Object.values(stockBySize)), stockBySize };
    });
  }

  async findAll() {
    const products = await this.prisma.product.findMany({
      where: { isAvailable: true },
      include: { prices: { orderBy: { size: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return this.withIngredientAvailability(products);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isAvailable: true },
      include: { prices: { orderBy: { size: 'asc' } } },
    });
    return product ? (await this.withIngredientAvailability([product]))[0] : null;
  }

  async findByCategory(category: string) {
    const products = await this.prisma.product.findMany({
      where: { isAvailable: true, category },
      include: { prices: { orderBy: { size: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return this.withIngredientAvailability(products);
  }

  async findAllToppings() {
    return this.prisma.topping.findMany({
      where: { isAvailable: true },
      orderBy: { price: 'asc' },
    });
  }

  async getBestSellers(limit = 4) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 ngày gần nhất
    const include = { prices: { orderBy: { size: 'asc' as const } } };

    // 1. Xếp hạng theo doanh số thật, chỉ tính món còn bán
    const sales = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        product: { isAvailable: true },
        order: {
          status: { in: ['PAID', 'PREPARING', 'READY', 'COMPLETED'] },
          createdAt: { gte: since },
        },
      },
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: limit,
    });

    const ids = sales.map((s) => s.productId).filter((id): id is string => id !== null);

    const topProducts =
      ids.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: ids }, isAvailable: true },
            include,
          })
        : [];

    // Giữ đúng thứ tự theo doanh số
    const byId = new Map(topProducts.map((p) => [p.id, p]));
    const ranked = ids
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .slice(0, limit)
      .map((p) => ({ ...p, isBestSeller: true })); // Hiển thị nhãn món bán chạy.

    if (ranked.length >= limit) {
      return (await this.withIngredientAvailability(ranked)).filter((product) => product.stock > 0);
    }

    // 2. Chưa đủ thì bổ sung món mặc định (không trùng, còn hàng)
    const fallback = await this.prisma.product.findMany({
      where: {
        isAvailable: true,
        id: { notIn: ranked.map((p) => p.id) },
      },
      include,
      orderBy: { createdAt: 'desc' }, // có thể đổi thành { name: 'asc' }
      take: limit - ranked.length,
    });

    // Đánh dấu các món bổ sung để hiển thị trong danh sách bán chạy.
    return (await this.withIngredientAvailability([
      ...ranked,
      ...fallback.map((p) => ({ ...p, isBestSeller: true })),
    ])).filter((product) => product.stock > 0);
  }
}
