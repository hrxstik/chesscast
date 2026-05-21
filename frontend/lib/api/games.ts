import { apiFetch } from './client';
import type { GamesCursorResponse } from './types';

export type CreateGameBody = {
  visibility?: 'PRIVATE' | 'PUBLIC';
  organizationId?: number;
};

export type CreatedGameDto = {
  id: number;
  token: string;
  visibility: string;
  status: string;
};

export async function createGame(body: CreateGameBody): Promise<CreatedGameDto> {
  return apiFetch<CreatedGameDto>('/game', {
    method: 'POST',
    body,
  });
}

export async function fetchMyGamesPage(params: {
  cursor?: number;
  limit?: number;
  status?: string;
  organizationId?: number;
  result?: string;
  token?: string;
  from?: string;
  to?: string;
}): Promise<GamesCursorResponse> {
  const sp = new URLSearchParams();
  if (params.cursor != null) sp.set('cursor', String(params.cursor));
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.status) sp.set('status', params.status);
  if (params.organizationId != null) sp.set('organizationId', String(params.organizationId));
  if (params.result) sp.set('result', params.result);
  if (params.token) sp.set('token', params.token);
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  const q = sp.toString();
  return apiFetch<GamesCursorResponse>(`/game/me${q ? `?${q}` : ''}`);
}
