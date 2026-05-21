import { apiFetch } from './client';
import type { GameListItem, GamesCursorResponse } from './types';

export type MyOrganizationDto = {
  id: number;
  name: string;
  description: string;
  inviteCode: string;
  joinPolicy?: string;
  role: 'PLAYER' | 'ADMIN';
  isActive: boolean;
};

export type OrganizationMemberDto = {
  userId: number;
  role: 'PLAYER' | 'ADMIN';
  user: {
    id: number;
    name: string;
    email: string;
    avatar: string;
  };
};

export type OrganizationGameDto = GameListItem;

export type OrganizationLogDto = {
  type: string;
  createdAt: string;
  actor: { id: number; name: string } | null;
  payload: Record<string, unknown>;
};

export type OrganizationStatusDto = {
  organizationId: number;
  isActive: boolean;
};

export type OrganizationSearchDto = {
  id: number;
  name: string;
  description: string;
  blocked: boolean;
  blockedReason?: string | null;
  inviteCode?: string;
  joinPolicy?: string;
  isMember: boolean;
  role: 'PLAYER' | 'ADMIN' | null;
  isActive: boolean;
};

export async function fetchMyOrganizations(): Promise<MyOrganizationDto[]> {
  return apiFetch<MyOrganizationDto[]>('/organization/me/list');
}

export type OrganizationCreateEligibilityDto = {
  canCreate: boolean;
  adminOrganizationsCount: number;
  maxOrganizations: number;
  canCreateOrganization: boolean;
  planTitle: string | null;
  message: string | null;
};

export async function fetchOrganizationCreateEligibility(): Promise<OrganizationCreateEligibilityDto> {
  return apiFetch<OrganizationCreateEligibilityDto>('/organization/me/create-eligibility');
}

export async function joinOrganizationByCode(inviteCode: string) {
  return apiFetch('/organization/join-by-code', {
    method: 'POST',
    body: { inviteCode },
  });
}

export async function joinOpenOrganization(organizationId: number) {
  return apiFetch(`/organization/join-open/${organizationId}`, { method: 'POST' });
}

export async function searchOrganizations(params: {
  q?: string;
  id?: number;
}): Promise<OrganizationSearchDto[]> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.id != null) sp.set('id', String(params.id));
  const query = sp.toString();
  return apiFetch<OrganizationSearchDto[]>(`/organization/search${query ? `?${query}` : ''}`);
}

export async function createOrganization(body: {
  name: string;
  description: string;
  joinPolicy?: 'OPEN' | 'INVITE_ONLY';
}) {
  return apiFetch<{ id: number; name: string; inviteCode: string }>('/organization/create', {
    method: 'POST',
    body,
  });
}

export async function fetchOrganization(id: number) {
  return apiFetch<{
    id: number;
    name: string;
    description?: string;
    inviteCode?: string;
    joinPolicy?: string;
    createdAt?: string;
    updatedAt?: string;
  }>(`/organization/${id}`);
}

export async function fetchOrganizationStatus(id: number): Promise<OrganizationStatusDto> {
  return apiFetch<OrganizationStatusDto>(`/organization/${id}/status`);
}

export type OrganizationMembershipDto = {
  isMember: boolean;
  role: 'PLAYER' | 'ADMIN' | null;
  isAdmin: boolean;
};

export async function fetchMyOrganizationMembership(
  organizationId: number,
): Promise<OrganizationMembershipDto> {
  return apiFetch<OrganizationMembershipDto>(
    `/organization/${organizationId}/membership`,
  );
}

export async function fetchOrganizationMembers(id: number): Promise<OrganizationMemberDto[]> {
  return apiFetch<OrganizationMemberDto[]>(`/organization/${id}/members`);
}

export async function removeOrganizationMember(organizationId: number, userId: number) {
  return apiFetch(`/organization/${organizationId}/members/${userId}/remove`, {
    method: 'POST',
  });
}

export async function fetchOrganizationGamesPage(params: {
  organizationId: number;
  cursor?: number;
  limit?: number;
  status?: string;
  result?: string;
  token?: string;
  from?: string;
  to?: string;
}): Promise<GamesCursorResponse> {
  const q = new URLSearchParams();
  if (params.cursor != null) q.set('cursor', String(params.cursor));
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  if (params.result) q.set('result', params.result);
  if (params.token) q.set('token', params.token);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const query = q.toString();
  return apiFetch<GamesCursorResponse>(
    `/organization/${params.organizationId}/games${query ? `?${query}` : ''}`,
  );
}

export async function fetchOrganizationLogs(
  id: number,
  filters?: { type?: string; from?: string; to?: string; limit?: number },
): Promise<OrganizationLogDto[]> {
  const q = new URLSearchParams();
  if (filters?.type) q.set('type', filters.type);
  if (filters?.from) q.set('from', filters.from);
  if (filters?.to) q.set('to', filters.to);
  if (typeof filters?.limit === 'number') q.set('limit', String(filters.limit));
  return apiFetch<OrganizationLogDto[]>(`/organization/${id}/logs${q.size ? `?${q}` : ''}`);
}

export async function updateOrganization(
  id: number,
  body: Partial<{
    name: string;
    description: string;
    joinPolicy: 'OPEN' | 'INVITE_ONLY';
  }>,
) {
  return apiFetch(`/organization/${id}`, {
    method: 'PATCH',
    body,
  });
}

export async function recreateOrganizationInviteCode(id: number) {
  return apiFetch<{ inviteCode: string }>(`/organization/${id}/recreate-invite-code`, {
    method: 'POST',
  });
}

export async function deleteOrganization(id: number) {
  return apiFetch(`/organization/${id}`, {
    method: 'DELETE',
  });
}
