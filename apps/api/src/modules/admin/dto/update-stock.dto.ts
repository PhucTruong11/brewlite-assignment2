import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateStockDto {
  @IsOptional()
  @IsInt({ message: 'Số lượng cộng thêm phải là số nguyên' })
  @Min(0, { message: 'Số lượng cộng thêm không được âm' })
  quantityToAdd?: number;

  @IsOptional()
  @IsInt({ message: 'Số lượng tồn kho phải là số nguyên' })
  @Min(0, { message: 'Số lượng tồn kho không được âm' })
  stock?: number;
}
