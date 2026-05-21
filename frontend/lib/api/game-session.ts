import { apiFetch } from './client';
import { ApiError } from './types';

export type GameSessionPlayer = {
  userId: number;
  name: string;
  avatar: string;
  color: 'WHITE' | 'BLACK';
};

export type GameSessionPublic = {
  id: number;
  token: string;
  result: string;
  status: string;
  visibility: string;
  initialPosition: string;
  moves: string[];
  createdAt: string;
  organization: { id: number; name: string } | null;
  players: GameSessionPlayer[];
  canConduct: boolean;
  canWatchLive: boolean;
  canAnalyze: boolean;
};

export type GameSessionResult =
  | { ok: true; data: GameSessionPublic }
  | { ok: false; forbidden: true }
  | { ok: false; notFound: true };

/** Передаёт JWT при наличии — нужно для приватных партий (см. п.4 ТЗ). */
export async function fetchGameSessionPublic(token: string): Promise<GameSessionResult> {
  try {
    const data = await apiFetch<GameSessionPublic>(
      `/game/session/${encodeURIComponent(token)}`,
    );
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 403) return { ok: false, forbidden: true };
      if (e.status === 404) return { ok: false, notFound: true };
    }
    return { ok: false, notFound: true };
  }
}
