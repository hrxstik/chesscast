import { Module } from '@nestjs/common';
import { AdminBillingController } from './admin-billing.controller';
import { AdminBillingService } from './admin-billing.service';
import { SuperAdminGuard } from 'src/guards/super-admin.guard';
import { AdminManagementController } from './admin-management.controller';
import { AdminManagementService } from './admin-management.service';

@Module({
  controllers: [AdminBillingController, AdminManagementController],
  providers: [AdminBillingService, AdminManagementService, SuperAdminGuard],
})
export class AdminModule {}
