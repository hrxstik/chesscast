import { createGame } from '@/lib/api/games';

export async function submitCreateGame(
  visibility: 'PRIVATE' | 'PUBLIC',
  organizationId?: number,
  players?: { whitePlayerId?: number; blackPlayerId?: number },
) {
  return createGame({
    visibility,
    ...(organizationId != null ? { organizationId } : {}),
    ...(players?.whitePlayerId != null ? { whitePlayerId: players.whitePlayerId } : {}),
    ...(players?.blackPlayerId != null ? { blackPlayerId: players.blackPlayerId } : {}),
  });
}
