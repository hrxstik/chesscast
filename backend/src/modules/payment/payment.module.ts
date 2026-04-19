import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { YookassaApiService } from './yookassa-api.service';
import { SubscriptionRenewalProcessor } from './subscription-renewal.processor';
import { SubscriptionRenewalCron } from './subscription-renewal.cron';

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: 'subscriptions' })],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    YookassaApiService,
    SubscriptionRenewalProcessor,
    SubscriptionRenewalCron,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
