/**
 * Format số tiền VND
 * @example formatVND(45000) => "45.000đ"
 */
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

/**
 * Tính giá theo size
 */
export function calculateSizePrice(basePrice: number, size: 'S' | 'M' | 'L'): number {
  const multipliers: Record<string, number> = {
    S: 1.0,
    M: 1.2,
    L: 1.5,
  };
  return Math.round(basePrice * (multipliers[size] || 1.0));
}

/**
 * Tính tổng giá cho 1 item (size + toppings)
 */
export function calculateItemPrice(
  basePrice: number,
  size: 'S' | 'M' | 'L',
  toppingPrices: number[],
): number {
  const sizePrice = calculateSizePrice(basePrice, size);
  const toppingsTotal = toppingPrices.reduce((sum, p) => sum + p, 0);
  return sizePrice + toppingsTotal;
}
