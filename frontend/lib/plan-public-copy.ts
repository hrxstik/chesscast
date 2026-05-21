import type { PlanLimitsDto } from '@/lib/plan-capabilities';
import { describePlanLimits } from '@/lib/plan-capabilities';

export type PublicPlanLimits = PlanLimitsDto & {
  code: string;
};

const STREAM_QUALITY_LABEL: Record<PlanLimitsDto['streamQualityLevel'], string> = {
  LOW: 'базовое',
  MEDIUM: 'среднее',
  HIGH: 'высокое',
};

/** Подпись лимита партий для тарифа (FREE — в сутки, остальные — в месяц). */
export function formatGamesLimitLine(plan: PublicPlanLimits): string {
  if (plan.code === 'FREE') {
    return `Не более ${plan.maxGamesPerPeriod} создаваемых партий в сутки`;
  }
  return `До ${plan.maxGamesPerPeriod} партий за календарный месяц`;
}

/** Пункты FAQ «Что с бесплатным планом?» по лимитам из БД. */
export function freePlanFaqLines(plan: PublicPlanLimits): string[] {
  const { limitations } = describePlanLimits(plan, plan.code);
  const lines: string[] = [formatGamesLimitLine(plan)];

  if (plan.canStream) {
    lines.push(
      `Трансляция с распознаванием доски (качество потока: ${STREAM_QUALITY_LABEL[plan.streamQualityLevel]})`,
    );
  } else {
    lines.push('Создание и трансляция партий недоступны');
  }

  if (plan.maxOrganizations > 0 && plan.canCreateOrganization) {
    lines.push(
      `Создание организаций — до ${plan.maxOrganizations} клубов, где вы администратор`,
    );
  } else {
    lines.push('Создание и ведение организаций недоступно');
  }

  lines.push('Разбор завершенных партий и просмотр по правилам видимости');
  lines.push(...limitations.filter((l) => !lines.includes(l)));

  return [...new Set(lines)];
}
