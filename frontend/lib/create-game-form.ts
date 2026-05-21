import { createGame } from '@/lib/api/games';

export async function submitCreateGame(
  visibility: 'PRIVATE' | 'PUBLIC',
  organizationId?: number,
) {
  return createGame({
    visibility,
    ...(organizationId != null ? { organizationId } : {}),
  });
}
