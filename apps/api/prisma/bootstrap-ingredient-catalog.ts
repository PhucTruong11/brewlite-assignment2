import { IngredientUnit, Prisma, PrismaClient, ProductSize } from '@prisma/client';

// Chạy sau khi cập nhật cấu trúc cơ sở dữ liệu. Chạy lại không đổi tồn kho và định lượng công thức;
// chỉ bảo đảm danh mục món đã chọn tiếp tục được bán.
const prisma = new PrismaClient();
const sizes: ProductSize[] = ['S', 'M', 'L'];
type Amounts = readonly [number, number, number];
type IngredientCode =
  | 'COFFEE_BEANS' | 'WATER' | 'SUGAR' | 'CONDENSED_MILK'
  | 'FRESH_MILK' | 'CARAMEL_SYRUP' | 'BREWED_TEA'
  | 'PEACH_SYRUP' | 'LEMONGRASS' | 'ICE' | 'CUP_S'
  | 'CUP_M' | 'CUP_L' | 'STRAW' | 'WHITE_PEARLS'
  | 'COFFEE_JELLY' | 'SALTED_CREAM';

type IngredientDefinition = {
  code: IngredientCode;
  name: string;
  unit: IngredientUnit;
  trackStock?: boolean;
  packageQuantity?: number;
};

const ingredients: IngredientDefinition[] = [
  { code: 'COFFEE_BEANS', name: 'Hạt cà phê', unit: 'G', packageQuantity: 10000 },
  { code: 'WATER', name: 'Nước', unit: 'ML', trackStock: false },
  { code: 'SUGAR', name: 'Đường', unit: 'G', packageQuantity: 10000 },
  { code: 'CONDENSED_MILK', name: 'Sữa đặc', unit: 'ML', packageQuantity: 10000 },
  { code: 'FRESH_MILK', name: 'Sữa tươi', unit: 'ML', packageQuantity: 10000 },
  { code: 'CARAMEL_SYRUP', name: 'Syrup caramel', unit: 'ML' },
  { code: 'BREWED_TEA', name: 'Trà pha sẵn', unit: 'ML', packageQuantity: 10000 },
  { code: 'PEACH_SYRUP', name: 'Syrup đào', unit: 'ML' },
  { code: 'LEMONGRASS', name: 'Sả', unit: 'G' },
  { code: 'ICE', name: 'Đá', unit: 'G' },
  { code: 'CUP_S', name: 'Ly size S', unit: 'PIECE' },
  { code: 'CUP_M', name: 'Ly size M', unit: 'PIECE' },
  { code: 'CUP_L', name: 'Ly size L', unit: 'PIECE' },
  { code: 'STRAW', name: 'Ống hút', unit: 'PIECE' },
  { code: 'WHITE_PEARLS', name: 'Trân châu trắng', unit: 'G' },
  { code: 'COFFEE_JELLY', name: 'Thạch cà phê', unit: 'G' },
  { code: 'SALTED_CREAM', name: 'Kem sữa mặn', unit: 'ML' },
];

type DrinkDefinition = {
  name: string;
  formula: Partial<Record<IngredientCode, Amounts>>;
};

// Định lượng mẫu lấy từ INVENTORY_RECIPE_PLAN.md, cần nhóm xác nhận trước khi dùng
// làm công thức thực tế. Mỗi giá trị tương ứng với một ly cỡ S/M/L.
const drinks: DrinkDefinition[] = [
  {
    name: 'Phin Đen Đá',
    formula: { COFFEE_BEANS: [18, 24, 30], WATER: [80, 110, 140], SUGAR: [6, 8, 10] },
  },
  {
    name: 'Phin Sữa Đá',
    formula: { COFFEE_BEANS: [18, 24, 30], WATER: [70, 100, 130], CONDENSED_MILK: [25, 35, 45] },
  },
  {
    name: 'Bạc Xỉu',
    formula: {
      COFFEE_BEANS: [8, 12, 16], WATER: [30, 40, 50],
      FRESH_MILK: [90, 130, 170], CONDENSED_MILK: [25, 35, 45],
    },
  },
  {
    name: 'Americano',
    formula: { COFFEE_BEANS: [18, 24, 30], WATER: [150, 220, 290] },
  },
  {
    name: 'Caramel Macchiato',
    formula: {
      COFFEE_BEANS: [16, 22, 28], WATER: [30, 40, 50],
      FRESH_MILK: [100, 140, 180], CARAMEL_SYRUP: [15, 20, 25],
    },
  },
  {
    name: 'Trà Thanh Đào',
    formula: {
      BREWED_TEA: [150, 220, 290], PEACH_SYRUP: [25, 35, 45],
      SUGAR: [5, 7, 9], LEMONGRASS: [5, 7, 9], WATER: [30, 40, 50],
    },
  },
];

const toppingFormula: Record<string, { code: IngredientCode; quantity: number }> = {
  'Trân Châu Trắng': { code: 'WHITE_PEARLS', quantity: 30 },
  'Thạch Cà Phê': { code: 'COFFEE_JELLY', quantity: 30 },
  'Kem Sữa Mặn': { code: 'SALTED_CREAM', quantity: 25 },
};

async function main() {
  const selectedNames = drinks.map((drink) => drink.name);
  const selectedToppings = Object.keys(toppingFormula);
  const [products, toppings] = await Promise.all([
    prisma.product.findMany({
      where: { name: { in: selectedNames } },
      include: { prices: true },
    }),
    prisma.topping.findMany({ where: { name: { in: selectedToppings } } }),
  ]);

  for (const name of selectedNames) {
    const matches = products.filter((product) => product.name === name);
    if (matches.length !== 1) throw new Error(`Cần đúng một sản phẩm tên "${name}", tìm thấy ${matches.length}`);
    for (const size of sizes) {
      if (!matches[0].prices.some((price) => price.size === size)) {
        throw new Error(`Sản phẩm "${name}" thiếu giá size ${size}`);
      }
    }
  }
  for (const name of selectedToppings) {
    if (toppings.filter((topping) => topping.name === name).length !== 1) {
      throw new Error(`Cần đúng một topping tên "${name}"`);
    }
  }

  // Dừng trước khi sửa danh mục nếu nguyên liệu hiện có khác đơn vị hoặc
  // khác chính sách quản lý tồn so với dữ liệu mẫu.
  const existingIngredients = await prisma.ingredient.findMany({
    where: { code: { in: ingredients.map((ingredient) => ingredient.code) } },
  });
  for (const current of existingIngredients) {
    const definition = ingredients.find((ingredient) => ingredient.code === current.code)!;
    if (current.unit !== definition.unit || current.trackStock !== (definition.trackStock ?? true)) {
      throw new Error(`Nguyên liệu ${current.code} đã có đơn vị hoặc chính sách stock khác`);
    }
  }

  const productByName = new Map(products.map((product) => [product.name, product]));
  const toppingByName = new Map(toppings.map((topping) => [topping.name, topping]));

  await prisma.$transaction(async (tx) => {
    const ingredientByCode = new Map<IngredientCode, string>();
    for (const definition of ingredients) {
      const trackStock = definition.trackStock ?? true;
      const ingredient = await tx.ingredient.upsert({
        where: { code: definition.code },
        update: {}, // Chạy lại không đặt lại tồn kho hoặc quy cách nhập đã được quản trị viên chỉnh.
        create: {
          code: definition.code,
          name: definition.name,
          unit: definition.unit,
          trackStock,
          onHand: trackStock ? 0 : null,
          reserved: trackStock ? 0 : null,
          packageQuantity: definition.packageQuantity ?? null,
        },
      });
      ingredientByCode.set(definition.code, ingredient.id);
    }

    const recipeRows: Prisma.RecipeCreateManyInput[] = [];
    for (const drink of drinks) {
      const productId = productByName.get(drink.name)!.id;
      for (const [index, size] of sizes.entries()) {
        const formula: Partial<Record<IngredientCode, number>> = {
          ICE: [120, 160, 200][index],
          STRAW: 1,
          [`CUP_${size}`]: 1,
        };
        for (const [code, amounts] of Object.entries(drink.formula) as [IngredientCode, Amounts][]) {
          formula[code] = amounts[index];
        }
        for (const [code, quantity] of Object.entries(formula) as [IngredientCode, number][]) {
          recipeRows.push({ productId, size, ingredientId: ingredientByCode.get(code)!, quantity });
        }
      }
    }
    for (const [name, { code, quantity }] of Object.entries(toppingFormula)) {
      recipeRows.push({
        toppingId: toppingByName.get(name)!.id,
        ingredientId: ingredientByCode.get(code)!,
        quantity,
      });
    }

    await tx.recipe.createMany({ data: recipeRows, skipDuplicates: true });
    await tx.product.updateMany({
      where: { id: { notIn: products.map((product) => product.id) } },
      data: { isAvailable: false },
    });
    await tx.product.updateMany({
      where: { id: { in: products.map((product) => product.id) } },
      data: { isAvailable: true },
    });
    await tx.topping.updateMany({
      where: { id: { notIn: toppings.map((topping) => topping.id) } },
      data: { isAvailable: false },
    });
    await tx.topping.updateMany({
      where: { id: { in: toppings.map((topping) => topping.id) } },
      data: { isAvailable: true },
    });
  }, { timeout: 30_000 });

  console.log(`Catalog ready: ${drinks.length} drinks, ${selectedToppings.length} toppings, ${ingredients.length} ingredients`);
  console.log('Tracked ingredients start at 0; use inventory:demo-stock only for local demo inventory.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
