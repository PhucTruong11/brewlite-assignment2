import { IsNotEmpty, IsUUID } from 'class-validator';

export class RedeemRewardDto {
  @IsNotEmpty({ message: 'rewardItemId là bắt buộc' })
  @IsUUID(undefined, { message: 'rewardItemId phải là UUID hợp lệ' })
  rewardItemId: string;
}