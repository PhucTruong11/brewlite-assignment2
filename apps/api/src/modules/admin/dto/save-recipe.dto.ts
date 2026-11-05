import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsUUID, Max, Min, ValidateNested, } from 'class-validator';

export class RecipeIngredientDto {
    @IsUUID()
    ingredientId: string;

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001, { message: 'Định lượng phải lớn hơn 0' })
    @Max(99_999_999_999.999)
    quantity: number;
}

export class SaveRecipeDto {
    @IsArray()
    @ArrayMinSize(1, { message: 'Công thức cần ít nhất một nguyên liệu' })
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => RecipeIngredientDto)
    ingredients: RecipeIngredientDto[];

    // Công thức lúc bắt đầu sửa, dùng để phát hiện người khác đã lưu trước.
    @IsArray()
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => RecipeIngredientDto)
    expectedIngredients: RecipeIngredientDto[];
}