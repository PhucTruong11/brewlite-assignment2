import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

// Bảng chuyển trạng thái hợp lệ: key = trạng thái hiện tại, value = các trạng thái được phép chuyển tới
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
    PAYMENT_FAILED: ['PAID', 'CANCELLED'],
    PAID: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY'],
    READY: ['COMPLETED'],
    COMPLETED: [], // trạng thái cuối
    CANCELLED: [], // trạng thái cuối
};

// Ném lỗi 400 nếu chuyển trạng thái không hợp lệ
export function assertTransition(current: OrderStatus, next: OrderStatus): void {
    if (!ALLOWED_TRANSITIONS[current].includes(next)) {
        throw new BadRequestException(
            `Không thể chuyển đơn từ ${current} sang ${next}`,
        );
    }
}