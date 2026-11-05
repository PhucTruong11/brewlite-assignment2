import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

// DTO (Data Transfer Object) — Định nghĩa dữ liệu đầu vào hợp lệ
// NestJS sẽ tự động validate và trả lỗi 400 nếu không đúng format
export class CreateCheckoutDto {
  @IsNotEmpty({ message: 'orderId là bắt buộc' })
  @IsUUID('4', { message: 'orderId phải là UUID hợp lệ' })
  orderId: string;

  @IsNotEmpty({ message: 'method là bắt buộc' })
  @IsEnum(PaymentMethod, {
    message: 'method phải là EWALLET (ví điện tử) hoặc CARD (thẻ)',
  })
  method: PaymentMethod;

  @IsOptional()
  @IsString({ message: 'promoCode phải là chuỗi ký tự' })
  promoCode?: string;
}
