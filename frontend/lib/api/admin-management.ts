import { apiFetch } from './client';

export type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  blocked: boolean;
  blockedReason?: string | null;
  platformRole: 'USER' | 'SUPERADMIN';
  createdAt: string;
};

export type AdminOrganizationRow = {
  id: number;
  name: string;
  blocked: boolean;
  blockedReason?: string | null;
  inviteCode: string;
  createdAt: string;
};

export type AdminServiceLogRow = {
  id: number;
  type: string;
  action: string;
  message: string;
  createdAt: string;
  actorName: string;
  actorEmail?: string | null;
  targetType?: string | null;
  targetId?: number | null;
};

function buildListQuery(params?: {
  q?: string;
  blocked?: boolean;
  cursor?: number;
  limit?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.q?.trim()) sp.set('q', params.q.trim());
  if (params?.blocked === true) sp.set('blocked', 'true');
  if (params?.blocked === false) sp.set('blocked', 'false');
  if (params?.cursor != null) sp.set('cursor', String(params.cursor));
  if (params?.limit != null) sp.set('limit', String(params.limit));
  return sp.toString();
}

export async function fetchAdminUsers(params?: {
  q?: string;
  blocked?: boolean;
}): Promise<{ items: AdminUserRow[]; nextCursor: number | null }> {
  const q = buildListQuery(params);
  return apiFetch(`/admin/users${q ? `?${q}` : ''}`);
}

export async function setAdminUserBlocked(id: number, blocked: boolean, reason: string) {
  return apiFetch(`/admin/users/${id}/block`, {
    method: 'PATCH',
    body: { blocked, reason },
  });
}

export async function fetchAdminOrganizations(params?: {
  q?: string;
  blocked?: boolean;
}): Promise<{ items: AdminOrganizationRow[]; nextCursor: number | null }> {
  const q = buildListQuery(params);
  return apiFetch(`/admin/organizations${q ? `?${q}` : ''}`);
}

export async function setAdminOrganizationBlocked(
  id: number,
  blocked: boolean,
  reason: string,
) {
  return apiFetch(`/admin/organizations/${id}/block`, {
    method: 'PATCH',
    body: { blocked, reason },
  });
}

export async function fetchAdminServiceLogs(params?: {
  type?: string;
  limit?: number;
}): Promise<{ items: AdminServiceLogRow[]; nextCursor: number | null; stub: boolean }> {
  const sp = new URLSearchParams();
  if (params?.type) sp.set('type', params.type);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const q = sp.toString();
  return apiFetch(`/admin/service-logs${q ? `?${q}` : ''}`);
}
