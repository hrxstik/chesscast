import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StreamQualityLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PublicPlanDto = {
  id: number;
  code: string;
  title: string;
  description: string;
  features: string[];
  price: string;
};

export type AdminPlanDto = {
  id: number;
  code: string;
  title: string;
  description: string;
  features: string[];
  maxGamesPerPeriod: number;
  maxOrganizations: number;
  canCreateOrganization: boolean;
  canStream: boolean;
  streamQualityLevel: StreamQualityLevel;
  priceMonthly: string;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePlanInput = {
  code: string;
  title: string;
  description?: string;
  features?: string[];
  maxGamesPerPeriod: number;
  maxOrganizations: number;
  canCreateOrganization: boolean;
  canStream: boolean;
  streamQualityLevel: StreamQualityLevel;
  priceMonthly: string;
  currency?: string;
  isActive?: boolean;
};

export type UpdatePlanInput = Partial<CreatePlanInput>;

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlans(activeOnly = true): Promise<PublicPlanDto[]> {
    const plans = await this.prisma.plan.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { priceMonthly: 'asc' },
    });

    return plans.map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      description: p.description,
      features: p.features,
      price: this.formatPrice(p.priceMonthly, p.currency),
    }));
  }

  async getPlansAdmin(activeOnly?: boolean): Promise<AdminPlanDto[]> {
    const plans = await this.prisma.plan.findMany({
      where: activeOnly === undefined ? undefined : { isActive: activeOnly },
      orderBy: { id: 'asc' },
    });
    return plans.map((p) => ({
      ...p,
      priceMonthly: p.priceMonthly.toString(),
    }));
  }

  async createPlan(input: CreatePlanInput): Promise<AdminPlanDto> {
    const created = await this.prisma.plan.create({
      data: {
        code: input.code.trim().toUpperCase(),
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        features: input.features ?? [],
        maxGamesPerPeriod: input.maxGamesPerPeriod,
        maxOrganizations: input.maxOrganizations,
        canCreateOrganization: input.canCreateOrganization,
        canStream: input.canStream,
        streamQualityLevel: input.streamQualityLevel,
        priceMonthly: new Prisma.Decimal(input.priceMonthly),
        currency: input.currency?.trim().toUpperCase() || 'RUB',
        isActive: input.isActive ?? true,
      },
    });
    return { ...created, priceMonthly: created.priceMonthly.toString() };
  }

  async updatePlan(id: number, input: UpdatePlanInput): Promise<AdminPlanDto> {
    const exists = await this.prisma.plan.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(`Plan ${id} not found`);
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data: {
        code: input.code?.trim().toUpperCase(),
        title: input.title?.trim(),
        description: input.description?.trim(),
        features: input.features,
        maxGamesPerPeriod: input.maxGamesPerPeriod,
        maxOrganizations: input.maxOrganizations,
        canCreateOrganization: input.canCreateOrganization,
        canStream: input.canStream,
        streamQualityLevel: input.streamQualityLevel,
        priceMonthly:
          input.priceMonthly !== undefined ? new Prisma.Decimal(input.priceMonthly) : undefined,
        currency: input.currency?.trim().toUpperCase(),
        isActive: input.isActive,
      },
    });

    return { ...updated, priceMonthly: updated.priceMonthly.toString() };
  }

  async disablePlan(id: number): Promise<AdminPlanDto> {
    return this.updatePlan(id, { isActive: false });
  }

  private formatPrice(amount: Prisma.Decimal, currency: string): string {
    const raw = amount.toString();
    if (raw === '0') return `0 ${currency}`;
    return `${raw} ${currency} / мес`;
  }
}
