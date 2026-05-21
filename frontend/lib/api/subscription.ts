import { apiFetch } from './client';

export type CurrentSubscriptionDto = {
  id: number;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PAUSED';
  startAt: string;
  endAt: string;
  /** Автопродление подписки (ЮKassa). */
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
    streamQualityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
};

export async function fetchMyCurrentSubscription(): Promise<CurrentSubscriptionDto | null> {
  return apiFetch<CurrentSubscriptionDto | null>('/subscription/me/current');
}

export async function fetchMySubscriptionHistory(): Promise<CurrentSubscriptionDto[]> {
  return apiFetch<CurrentSubscriptionDto[]>('/subscription/me/history');
}
