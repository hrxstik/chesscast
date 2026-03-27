import { apiFetch } from './client';

export type StreamQualityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

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
  createdAt: string;
  updatedAt: string;
};

export type CreatePlanBody = {
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

export async function fetchAdminPlans(activeOnly?: boolean): Promise<AdminPlanDto[]> {
  const sp = new URLSearchParams();
  if (activeOnly !== undefined) sp.set('activeOnly', String(activeOnly));
  const q = sp.toString();
  return apiFetch<AdminPlanDto[]>(`/pricing/admin${q ? `?${q}` : ''}`);
}

export async function createPlan(body: CreatePlanBody): Promise<AdminPlanDto> {
  return apiFetch<AdminPlanDto>('/pricing/admin', {
    method: 'POST',
    body,
  });
}

export async function updatePlan(
  id: number,
  body: Partial<CreatePlanBody>,
): Promise<AdminPlanDto> {
  return apiFetch<AdminPlanDto>(`/pricing/admin/${id}`, {
    method: 'PATCH',
    body,
  });
}

export async function disablePlan(id: number): Promise<AdminPlanDto> {
  return apiFetch<AdminPlanDto>(`/pricing/admin/${id}`, {
    method: 'DELETE',
  });
}
