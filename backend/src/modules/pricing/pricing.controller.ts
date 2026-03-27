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
  UseGuards,
} from '@nestjs/common';
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
  constructor(private readonly pricingService: PricingService) {}

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
  updatePlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePlanInput,
  ): Promise<AdminPlanDto> {
    return this.pricingService.updatePlan(id, body);
  }

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Delete('admin/:id')
  disablePlan(@Param('id', ParseIntPipe) id: number): Promise<AdminPlanDto> {
    return this.pricingService.disablePlan(id);
  }
}
