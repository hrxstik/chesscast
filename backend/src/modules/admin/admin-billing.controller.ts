import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { SuperAdminGuard } from 'src/guards/super-admin.guard';
import { AdminBillingService } from './admin-billing.service';

@Controller('admin/billing')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminBillingController {
  constructor(private readonly billing: AdminBillingService) {}

  @Get('summary')
  async summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.billing.getSummary(from, to);
  }

  @Get('events')
  async events(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 30;
    const cursorId =
      cursor !== undefined && cursor !== ''
        ? parseInt(cursor, 10)
        : undefined;
    if (cursorId !== undefined && Number.isNaN(cursorId)) {
      return { items: [], nextCursor: null };
    }
    return this.billing.listEvents(limitNum, cursorId);
  }
}
