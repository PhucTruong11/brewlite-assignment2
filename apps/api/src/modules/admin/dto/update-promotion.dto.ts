import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export class UpdatePromotionDto {
    @IsOptional()
    @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
    description?: string | null;

    @ValidateIf((_dto, value: unknown) => value !== undefined)
    @IsIn(['PERCENTAGE', 'FIXED_AMOUNT'], { message: 'Loại giảm giá không hợp lệ' })
    discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';

    @ValidateIf((_dto, value: unknown) => value !== undefined)
    @IsNumber({}, { message: 'Giá trị giảm phải là số' })
    @Min(0, { message: 'Giá trị giảm không được âm' })
    discountValue?: number;

    @ValidateIf((_dto, value: unknown) => value !== undefined)
    @IsNumber({}, { message: 'Đơn tối thiểu phải là số' })
    @Min(0, { message: 'Đơn tối thiểu không được âm' })
    minOrderValue?: number;

    @IsOptional()
    @IsNumber({}, { message: 'Giảm tối đa phải là số' })
    @Min(0, { message: 'Giảm tối đa không được âm' })
    maxDiscount?: number | null;

    @IsOptional()
    @IsDateString({}, { message: 'Ngày kết thúc phải đúng định dạng ngày (ISO 8601)' })
    endDate?: string | null;

    @ValidateIf((_dto, value: unknown) => value !== undefined)
    @IsInt({ message: 'Điểm đổi thưởng phải là số nguyên' })
    @Min(1, { message: 'Điểm đổi thưởng phải lớn hơn 0' })
    @Max(2_147_483_647)
    pointsCost?: number;
}
