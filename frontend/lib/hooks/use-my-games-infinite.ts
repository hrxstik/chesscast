import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchMyGamesPage } from '@/lib/api/games';

export function useMyGamesInfinite(limit = 20) {
  return useInfiniteQuery({
    queryKey: ['games', 'me', limit],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      fetchMyGamesPage({ cursor: pageParam, limit }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
