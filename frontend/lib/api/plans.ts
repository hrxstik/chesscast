import { ApiRoutes } from '../services/routes';
import { serverApiFetch } from './server-fetch';

export type PlanDto = {
  id: number;
  code: string;
  title: string;
  price: string;
  description: string;
  features: string[];
  maxGamesPerPeriod: number;
  maxOrganizations: number;
  canCreateOrganization: boolean;
  canStream: boolean;
  streamQualityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
};

export async function fetchPlans(): Promise<PlanDto[]> {
  const res = await serverApiFetch(`/${ApiRoutes.GET_PRICING}`, {
    next: { revalidate: 600 },
  });
  if (!res.ok) {
    throw new Error(
      `Не удалось загрузить тарифы (${res.status}). Проверьте, что API запущен (npm run start:dev в backend).`,
    );
  }
  const data = (await res.json()) as PlanDto[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Некорректный ответ API тарифов.');
  }
  return data;
}
