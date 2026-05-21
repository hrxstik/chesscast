export type PlanLimitsDto = {
  maxGamesPerPeriod: number;
  maxOrganizations: number;
  canCreateOrganization: boolean;
  canStream: boolean;
  streamQualityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
};

const STREAM_QUALITY_LABEL: Record<PlanLimitsDto['streamQualityLevel'], string> = {
  LOW: 'базовое',
  MEDIUM: 'среднее',
  HIGH: 'высокое',
};

/** Человекочитаемые возможности и ограничения тарифа для карточки профиля и т.п. */
export function formatGamesLimitLabel(
  plan: PlanLimitsDto,
  planCode?: string,
): string {
  if (planCode === 'FREE') {
    return `До ${plan.maxGamesPerPeriod} игр в сутки`;
  }
  return `До ${plan.maxGamesPerPeriod} игр за календарный месяц`;
}

export function describePlanLimits(
  plan: PlanLimitsDto,
  planCode?: string,
): {
  capabilities: string[];
  limitations: string[];
} {
  const capabilities: string[] = [];
  const limitations: string[] = [];

  capabilities.push(formatGamesLimitLabel(plan, planCode));

  if (plan.canStream) {
    capabilities.push(
      `Трансляция партий (качество потока: ${STREAM_QUALITY_LABEL[plan.streamQualityLevel]})`,
    );
  } else {
    limitations.push('Трансляция партий недоступна');
  }

  if (plan.canCreateOrganization && plan.maxOrganizations > 0) {
    capabilities.push(
      `Создание организаций — до ${plan.maxOrganizations} клубов, где вы администратор`,
    );
  } else {
    limitations.push('Создание и ведение организаций недоступно');
  }

  return { capabilities, limitations };
}

export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Активна',
  EXPIRED: 'Истекла',
  CANCELED: 'Отменена',
  PAUSED: 'Ожидает оплаты',
};
