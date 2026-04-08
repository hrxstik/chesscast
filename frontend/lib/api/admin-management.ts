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

export async function fetchAdminUsers(q?: string): Promise<{ items: AdminUserRow[]; nextCursor: number | null }> {
  const sp = new URLSearchParams();
  if (q?.trim()) sp.set('q', q.trim());
  return apiFetch(`/admin/users${sp.size ? `?${sp}` : ''}`);
}

export async function setAdminUserBlocked(id: number, blocked: boolean, reason?: string) {
  return apiFetch(`/admin/users/${id}/block`, {
    method: 'PATCH',
    body: { blocked, reason },
  });
}

export async function setAdminUserRole(id: number, platformRole: 'USER' | 'SUPERADMIN') {
  return apiFetch(`/admin/users/${id}/role`, {
    method: 'PATCH',
    body: { platformRole },
  });
}

export async function fetchAdminOrganizations(q?: string): Promise<{ items: AdminOrganizationRow[]; nextCursor: number | null }> {
  const sp = new URLSearchParams();
  if (q?.trim()) sp.set('q', q.trim());
  return apiFetch(`/admin/organizations${sp.size ? `?${sp}` : ''}`);
}

export async function setAdminOrganizationBlocked(id: number, blocked: boolean, reason?: string) {
  return apiFetch(`/admin/organizations/${id}/block`, {
    method: 'PATCH',
    body: { blocked, reason },
  });
}
