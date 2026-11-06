import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { OrderStatusBadge, OrderStatusStepper } from './OrderStatus';

describe('Hiển thị trạng thái đơn hàng', () => {
  it.each([
    ['PENDING', 'Chờ thanh toán'],
    ['PAID', 'Đã thanh toán'],
    ['PAYMENT_FAILED', 'Thanh toán thất bại'],
    ['CANCELLED', 'Đã hủy'],
  ] as const)('hiển thị nhãn của trạng thái %s', (status, label) => {
    const html = renderToStaticMarkup(createElement(OrderStatusBadge, { status }));
    expect(html).toContain(label);
  });

  it('hiển thị các bước xử lý sau khi thanh toán', () => {
    const html = renderToStaticMarkup(createElement(OrderStatusStepper, { status: 'PAID' }));
    expect(html).toContain('Đặt đơn');
    expect(html).toContain('Đã thanh toán');
    expect(html).toContain('Đang chuẩn bị');
    expect(html).toContain('Có thể nhận');
  });

  it('hiển thị lỗi thanh toán thay cho các bước xử lý', () => {
    const html = renderToStaticMarkup(createElement(OrderStatusStepper, { status: 'PAYMENT_FAILED' }));
    expect(html).toContain('Thanh toán thất bại');
    expect(html).not.toContain('Đang chuẩn bị');
  });
});
