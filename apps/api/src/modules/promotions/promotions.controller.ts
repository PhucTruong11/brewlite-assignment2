import { Controller, Get, Post, Body } from '@nestjs/common';
import { PromotionsService } from './promotions.service.js';
import { ApplyPromotionDto } from './dto/apply-promotion.dto.js';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  async findAll() {
    return this.promotionsService.findAll();
  }

  @Post('apply')
  async apply(@Body() dto: ApplyPromotionDto) {
    return this.promotionsService.applyPromotion(dto);
  }
}