import { Injectable } from '@nestjs/common';
import { Plan, Subscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CurrentSubscriptionDto = {
  id: number;
  status: SubscriptionStatus;
  startAt: Date;
  endAt: Date;
  autoRenew: boolean;
  plan: {
    id: number;
    code: string;
    title: string;
    description: string;
    features: string[];
    maxGamesPerPeriod: number;
    maxOrganizations: number;
    canCreateOrganization: boolean;
    canStream: boolean;
    streamQualityLevel: Plan['streamQualityLevel'];
  };
};

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(
    sub: Subscription & { plan: Plan },
  ): CurrentSubscriptionDto {
    const { plan } = sub;
    return {
      id: sub.id,
      status: sub.status,
      startAt: sub.startAt,
      endAt: sub.endAt,
      autoRenew: sub.autoRenew,
      plan: {
        id: plan.id,
        code: plan.code,
        title: plan.title,
        description: plan.description,
        features: plan.features,
        maxGamesPerPeriod: plan.maxGamesPerPeriod,
        maxOrganizations: plan.maxOrganizations,
        canCreateOrganization: plan.canCreateOrganization,
        canStream: plan.canStream,
        streamQualityLevel: plan.streamQualityLevel,
      },
    };
  }

  async getCurrentByUserId(userId: number): Promise<CurrentSubscriptionDto | null> {
    const now = new Date();
    const row = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        endAt: { gt: now },
      },
      include: { plan: true },
      orderBy: { endAt: 'desc' },
    });
    return row ? this.toDto(row) : null;
  }

  async getHistoryByUserId(userId: number): Promise<CurrentSubscriptionDto[]> {
    const rows = await this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }
}
