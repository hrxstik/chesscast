import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PlatformAuditType } from '@prisma/client';
import { PlatformAuditService } from '../audit/platform-audit.service';
import {
  PricingService,
  type AdminPlanDto,
  type CreatePlanInput,
  type PublicPlanDto,
  type UpdatePlanInput,
} from './pricing.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { SuperAdminGuard } from 'src/guards/super-admin.guard';

@Controller('pricing')
export class PricingController {
  constructor(
    private readonly pricingService: PricingService,
    private readonly audit: PlatformAuditService,
  ) {}

  @Get()
  getPricingPlans(): Promise<PublicPlanDto[]> {
    return this.pricingService.getPlans(true);
  }

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Get('admin')
  getAllPlans(@Query('activeOnly') activeOnly?: string): Promise<AdminPlanDto[]> {
    if (activeOnly === undefined) return this.pricingService.getPlansAdmin(undefined);
    return this.pricingService.getPlansAdmin(activeOnly === 'true');
  }

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Post('admin')
  createPlan(@Body() body: CreatePlanInput): Promise<AdminPlanDto> {
    return this.pricingService.createPlan(body);
  }

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Patch('admin/:id')
  async updatePlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePlanInput,
    @Req() req: Request & { user: { id: number } },
  ): Promise<AdminPlanDto> {
    const plan = await this.pricingService.updatePlan(id, body);
    if (body.isActive === true) {
      await this.audit.log({
        type: PlatformAuditType.PLAN,
        action: 'PLAN_ACTIVATED',
        message: `Тариф «${plan.title}» (${plan.code}) активирован`,
        actorUserId: req.user.id,
        targetType: 'plan',
        targetId: plan.id,
      });
    }
    return plan;
  }

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Delete('admin/:id')
  async disablePlan(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { id: number } },
  ): Promise<AdminPlanDto> {
    const plan = await this.pricingService.disablePlan(id);
    await this.audit.log({
      type: PlatformAuditType.PLAN,
      action: 'PLAN_DEACTIVATED',
      message: `Тариф «${plan.title}» (${plan.code}) деактивирован`,
      actorUserId: req.user.id,
      targetType: 'plan',
      targetId: plan.id,
      metadata: { code: plan.code, title: plan.title },
    });
    return plan;
  }
}
