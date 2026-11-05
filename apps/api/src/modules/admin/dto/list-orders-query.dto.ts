import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OrderStatus } from '@prisma/client';

// main.ts bật forbidNonWhitelisted nên MỌI query param đều phải khai báo ở đây
export class ListOrdersQueryDto {
    // "PAID,PREPARING" -> ['PAID', 'PREPARING']
    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
    @IsEnum(OrderStatus, { each: true, message: 'status không hợp lệ' })
    status?: OrderStatus[];

    @IsOptional()
    @IsIn(['today', '7d', 'all'])
    range?: 'today' | '7d' | 'all';

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsIn(['asc', 'desc'])
    sort?: 'asc' | 'desc';

    @IsOptional()
    @Type(() => Number) // query luôn là chuỗi, ép sang số
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number;
}