import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { RewardsService } from './rewards.service.js';
import { RedeemRewardDto } from './dto/redeem-reward.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@Controller('rewards')
@UseGuards(JwtAuthGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  // GET /api/rewards
  @Get()
  getOverview(@CurrentUser() user: { id: string }) {
    return this.rewardsService.getOverview(user.id);
  }

  // POST /api/rewards/redeem
  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  redeem(@Body() dto: RedeemRewardDto, @CurrentUser() user: { id: string }) {
    return this.rewardsService.redeem(user.id, dto.rewardItemId);
  }
}