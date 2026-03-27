import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { SuperAdminGuard } from 'src/guards/super-admin.guard';

@Module({
  controllers: [PricingController],
  providers: [PricingService, SuperAdminGuard],
})
export class PricingModule {}
