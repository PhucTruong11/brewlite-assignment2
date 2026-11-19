import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard, THROTTLER_OPTIONS } from './common/security/rate-limit.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { CheckoutModule } from './modules/checkout/checkout.module.js';
import { EmailModule } from './modules/email/email.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { RewardsModule } from './modules/rewards/rewards.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(THROTTLER_OPTIONS),
    PrismaModule,
    ProductsModule,
    AuthModule,
    OrdersModule,
    CheckoutModule,
    EmailModule,
    PromotionsModule,
    AdminModule,
    RewardsModule,
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule { }
