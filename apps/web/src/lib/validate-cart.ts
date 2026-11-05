import api from '@/lib/api';
import { toOrderItem, type CartItem } from '@/lib/cart';

export interface CartShortage {
  ingredientId: string;
  ingredientName: string;
  required: string;
  available: string;
  unit: string;
}

export interface CartValidation {
  available: boolean;
  shortages: CartShortage[];
  subtotal: number;
}

export async function validateCart(items: CartItem[]): Promise<CartValidation> {
  const response = await api.post<CartValidation>('/cart/validate', {
    items: items.map(toOrderItem),
  });
  return response.data;
}

export function cartValidationMessage(validation: CartValidation) {
  if (validation.available) return null;
  return `Không đủ nguyên liệu: ${validation.shortages.map((item) =>
    `${item.ingredientName} (còn ${item.available} ${item.unit}, cần ${item.required} ${item.unit})`).join(', ')}`;
}
