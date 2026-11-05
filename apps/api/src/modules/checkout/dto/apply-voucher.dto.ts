import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ApplyVoucherDto {
  @IsNotEmpty({ message: 'orderId là bắt buộc' })
  @IsUUID('4', { message: 'orderId phải là UUID hợp lệ' })
  orderId: string;

  @IsNotEmpty({ message: 'promoCode là bắt buộc' })
  @IsString({ message: 'promoCode phải là chuỗi ký tự' })
  promoCode: string;
}
