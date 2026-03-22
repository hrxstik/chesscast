import { ApiRoutes } from '../services/routes';

function pricingUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_NEST_API_URL?.replace(/\/$/, '') ||
    'http://localhost:5000/api';
  return `${base}/${ApiRoutes.GET_PRICING}`;
}

export type PlanDto = {
  title: string;
  price: string;
  description: string;
  features: string[];
};

export async function fetchPlans(): Promise<PlanDto[]> {
  const res = await fetch(pricingUrl(), {
    next: { revalidate: 600 },
  });
  if (!res.ok) {
    throw new Error(`Не удалось загрузить тарифы (${res.status}). Проверьте, что API запущен.`);
  }
  const data = (await res.json()) as PlanDto[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Некорректный ответ API тарифов.');
  }
  return data;
}
