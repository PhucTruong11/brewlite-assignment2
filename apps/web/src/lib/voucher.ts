export interface PromotionRules {
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number | null;
}

export interface AppliedPromo {
  code: string;
  discount: number;
  description: string;
  rules: PromotionRules;
}

type VoucherResult = {
  discount: number;
  message: string;
  description: string;
} & ({ valid: true; rules: PromotionRules } | { valid: false });

export function recalculatePromo(promo: AppliedPromo | null, subtotal: number): AppliedPromo | null {
  if (!promo || subtotal <= 0) return null;
  const rules = promo.rules;
  if (subtotal < rules.minOrderValue) return null;

  let discount = rules.discountType === 'PERCENTAGE'
    ? Math.floor(subtotal * rules.discountValue / 100)
    : rules.discountValue;

  if (rules.discountType === 'PERCENTAGE' && rules.maxDiscount) {
    discount = Math.min(discount, rules.maxDiscount);
  }

  return { ...promo, discount: Math.min(discount, subtotal) };
}

export function calculateVoucherDiscount(code: string, subtotal: number): VoucherResult {
  const clean = code.trim().toUpperCase();
  if (!clean) return { valid: false, discount: 0, message: 'Vui lòng nhập mã', description: '' };

  if (clean === 'WELCOME10') {
    if (subtotal < 30000) return { valid: false, discount: 0, message: 'Đơn từ 30k trở lên', description: 'Giảm 10%' };
    return {
      valid: true, discount: Math.min(15000, Math.floor(subtotal * 0.1)), message: 'Thành công', description: 'Giảm 10%',
      rules: { discountType: 'PERCENTAGE', discountValue: 10, minOrderValue: 30000, maxDiscount: 15000 },
    };
  }

  if (clean === 'FREESHIP') {
    if (subtotal < 30000) return { valid: false, discount: 0, message: 'Đơn từ 30k trở lên', description: 'Giảm 10k' };
    return {
      valid: true, discount: 10000, message: 'Thành công (-10k)', description: 'Giảm 10.000đ',
      rules: { discountType: 'FIXED_AMOUNT', discountValue: 10000, minOrderValue: 30000 },
    };
  }

  return { valid: false, discount: 0, message: 'Mã không tồn tại', description: '' };
}
