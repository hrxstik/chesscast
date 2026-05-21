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

export async function updateCurrentUser(id: number, body: Partial<{ name: string; avatar: string }>) {
  return apiFetch<MeResponse>(`/user/${id}`, {
    method: 'PATCH',
    body,
  });
}

export async function uploadMyAvatar(file: File): Promise<MeResponse> {
  const fd = new FormData();
  fd.append('image', file);
  return apiFetch<MeResponse>('/user/me/avatar', {
    method: 'POST',
    body: fd,
  });
}

export async function changeMyPassword(body: { currentPassword: string; newPassword: string }) {
  return apiFetch<{ success: true }>('/user/me/change-password', {
    method: 'POST',
    body,
  });
}

export async function deleteMyAccount(body: { password: string }) {
  return apiFetch<{ success: true }>('/user/me/delete', {
    method: 'POST',
    body,
  });
}

export type DashboardSummaryResponse = {
  gamesCount: number;
  organizationsCount: number;
  subscription: {
    status: string;
    endAt: string;
    plan: { code: string; title: string };
  } | null;
};

export async function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  return apiFetch<DashboardSummaryResponse>('/user/me/dashboard-summary');
}

export type PublicUserProfileResponse = {
  id: number;
  name: string;
  avatar: string;
  createdAt: string;
  organizations: Array<{
    id: number;
    name: string;
    role: 'PLAYER' | 'ADMIN';
    blocked: boolean;
  }>;
  recentGames: Array<{
    id: number;
    token: string;
    status: string;
    result: string;
    createdAt: string;
    color: 'WHITE' | 'BLACK';
    organization: { id: number; name: string } | null;
  }>;
};

export async function getPublicUserProfile(id: number): Promise<PublicUserProfileResponse> {
  return apiFetch<PublicUserProfileResponse>(`/user/${id}`);
}
