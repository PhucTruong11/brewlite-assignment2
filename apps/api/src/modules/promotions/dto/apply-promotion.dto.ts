import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class ApplyPromotionDto {
  @IsNotEmpty({ message: 'Mã ưu đãi không được để trống' })
  @IsString({ message: 'Mã ưu đãi phải là chuỗi ký tự' })
  code: string;

  @IsNotEmpty({ message: 'Tổng tiền không được để trống' })
  @IsNumber({}, { message: 'Tổng tiền phải là số' })
  @Min(0, { message: 'Tổng tiền không được nhỏ hơn 0' })
  subtotal: number;
}