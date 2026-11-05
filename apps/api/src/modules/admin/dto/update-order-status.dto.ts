import { IsEnum, IsNotEmpty } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
    // Chỉ nhận đúng các giá trị trong enum OrderStatus, sai là trả 400
    @IsNotEmpty({ message: 'status là bắt buộc' })
    @IsEnum(OrderStatus, { message: 'status không hợp lệ' })
    status: OrderStatus;
}