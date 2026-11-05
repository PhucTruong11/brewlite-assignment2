import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { CartController } from './cart.controller.js';

@Module({
  controllers: [CartController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
