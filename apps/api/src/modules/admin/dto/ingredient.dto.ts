import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf, } from 'class-validator';
import { IngredientUnit } from '@prisma/client';

export class CreateIngredientDto {
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim().toUpperCase() : value)
    @Matches(/^[A-Z0-9_]{2,40}$/, {
        message: 'Mã nguyên liệu cần 2–40 ký tự, chỉ gồm chữ, số và dấu gạch dưới',
    })
    code: string;

    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value)
    @IsString()
    @MinLength(1, { message: 'Tên nguyên liệu không được để trống' })
    @MaxLength(120)
    name: string;

    @IsEnum(IngredientUnit)
    unit: IngredientUnit;

    @IsBoolean()
    trackStock: boolean;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0)
    @Max(99_999_999_999.999)
    onHand?: number | null;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    @Max(99_999_999_999.999)
    packageQuantity?: number | null;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0)
    @Max(99_999_999_999.999)
    lowStockThreshold?: number | null;

    @ValidateIf((_object, value) => value !== undefined)
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateIngredientDto {
    @IsInt()
    @Min(1)
    version: number;

    @ValidateIf((_object, value) => value !== undefined)
    @Transform(({ value }) =>
        typeof value === 'string' ? value.trim() : value)
    @IsString()
    @MinLength(1, { message: 'Tên nguyên liệu không được để trống' })
    @MaxLength(120)
    name?: string;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    @Max(99_999_999_999.999)
    packageQuantity?: number | null;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0)
    @Max(99_999_999_999.999)
    lowStockThreshold?: number | null;

    @ValidateIf((_object, value) => value !== undefined)
    @IsBoolean()
    isActive?: boolean;
}

export class RestockIngredientDto {
    // Lượng đã quy đổi về g, ml hoặc cái.
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001, { message: 'Số lượng nhập phải lớn hơn 0' })
    @Max(99_999_999_999.999)
    quantity: number;
}