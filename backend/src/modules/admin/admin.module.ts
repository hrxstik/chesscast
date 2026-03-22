import { Module } from '@nestjs/common';
import { AdminBillingController } from './admin-billing.controller';
import { AdminBillingService } from './admin-billing.service';
import { SuperAdminGuard } from 'src/guards/super-admin.guard';

@Module({
  controllers: [AdminBillingController],
  providers: [AdminBillingService, SuperAdminGuard],
})
export class AdminModule {}
