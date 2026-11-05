import { describe, it, expect } from 'vitest';
import { getCartItemKey, getCartLineTotal, formatCartToppings, toOrderItem, type CartItem } from './cart';

const base: CartItem = { productId: 'p1', name: 'Trà Sữa', size: 'M', quantity: 1, unitPrice: 30000 };

describe('lib/cart (logic thuần của giỏ hàng)', () => {
  // [Gộp dòng] Cùng sản phẩm + size + topping (kể cả khác thứ tự) -> cùng key để store gộp số lượng.
  it('getCartItemKey: cùng sản phẩm/size/topping (khác thứ tự) cho cùng key', () => {
    const a = { ...base, toppings: ['Trân Châu Trắng', 'Thạch Đào'] };
    const b = { ...base, quantity: 3, toppings: ['Thạch Đào', 'Trân Châu Trắng'] };
    expect(getCartItemKey(a)).toBe(getCartItemKey(b));
  });

  // [Tách dòng] Khác size hoặc khác sản phẩm thì không được gộp.
  it('getCartItemKey: khác size hoặc khác sản phẩm cho key khác nhau', () => {
    expect(getCartItemKey(base)).not.toBe(getCartItemKey({ ...base, size: 'L' }));
    expect(getCartItemKey(base)).not.toBe(getCartItemKey({ ...base, productId: 'p2' }));
  });

  // [Tính tiền] Thành tiền = đơn giá * số lượng; đơn giá lỗi thì dùng lineTotal dự phòng.
  it('getCartLineTotal: tính unitPrice * quantity và fallback lineTotal', () => {
    expect(getCartLineTotal({ ...base, quantity: 3, unitPrice: 35000 })).toBe(105000);
    expect(getCartLineTotal({ ...base, quantity: 2, unitPrice: Number.NaN, lineTotal: 70000 })).toBe(70000);
  });

  // [Hiển thị] Topping số lượng > 1 hiển thị "xN".
  it('formatCartToppings: hiển thị xN khi số lượng > 1', () => {
    expect(formatCartToppings(undefined)).toBe('');
    expect(formatCartToppings([{ name: 'Trân Châu Trắng', quantity: 2 }, 'Thạch Đào']))
      .toBe('Thạch Đào, Trân Châu Trắng x2');
  });

  // [Gửi backend] Dữ liệu giỏ phải đúng định dạng CreateOrderItemDto (topping lặp tên theo số lượng).
  it('toOrderItem: chuyển CartItem sang payload đặt hàng', () => {
    const item = { ...base, size: 'L', quantity: 2, unitPrice: 45000,
      toppings: [{ name: 'Trân Châu Trắng', quantity: 2 }, { name: 'Thạch Đào', quantity: 1 }] };
    expect(toOrderItem(item)).toEqual({
      productId: 'p1', size: 'L', qty: 2,
      toppings: ['Thạch Đào', 'Trân Châu Trắng', 'Trân Châu Trắng'],
      lineTotal: 90000,
    });
  });
});
