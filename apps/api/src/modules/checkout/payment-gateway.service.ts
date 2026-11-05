import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';

// Cổng thanh toán mô phỏng; có thể thay bằng nhà cung cấp thật mà không đổi logic kho của đơn hàng.
@Injectable()
export class PaymentGatewayService {
  /** Cổng mô phỏng luôn báo thành công sau 100 ms; chưa có giao dịch tiền thật. */
  async charge(_amount: number, method: PaymentMethod): Promise<{ success: boolean; gatewayRef: string }> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { success: true, gatewayRef: `GW-${method}-${Date.now()}` };
  }
}
