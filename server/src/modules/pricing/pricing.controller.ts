import { Controller, Get } from '@nestjs/common';
import { PricingService, Plan } from './pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  getPricingPlans(): Plan[] {
    return this.pricingService.getPlans();
  }
}
