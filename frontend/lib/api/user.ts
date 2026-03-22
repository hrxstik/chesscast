import { apiFetch } from '@/lib/api/client';

/** Ответ GET /api/user/me (без password) */
export type MeResponse = {
  id: number;
  name: string;
  email: string;
  platformRole?: 'USER' | 'SUPERADMIN';
  avatar?: string;
};

export async function getCurrentUser(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/user/me');
}
