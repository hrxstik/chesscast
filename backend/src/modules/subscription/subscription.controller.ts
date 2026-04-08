import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { Request } from 'express';
import { SubscriptionService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me/current')
  async meCurrent(@Req() req: Request & { user: { id: number } }) {
    return this.subscriptionService.getCurrentByUserId(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/history')
  async meHistory(@Req() req: Request & { user: { id: number } }) {
    return this.subscriptionService.getHistoryByUserId(req.user.id);
  }
}
