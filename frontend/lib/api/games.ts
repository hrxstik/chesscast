import { apiFetch } from './client';
import type { GamesCursorResponse } from './types';

export type CreateGameBody = {
  mode: 'TRAINING' | 'COMPETITIVE';
  visibility?: 'PRIVATE' | 'PUBLIC';
  organizationId?: number;
};

export type CreatedGameDto = {
  id: number;
  token: string;
  mode: string;
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
}): Promise<GamesCursorResponse> {
  const sp = new URLSearchParams();
  if (params.cursor != null) sp.set('cursor', String(params.cursor));
  if (params.limit != null) sp.set('limit', String(params.limit));
  const q = sp.toString();
  return apiFetch<GamesCursorResponse>(`/game/me${q ? `?${q}` : ''}`);
}
