import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchMyGamesPage } from '@/lib/api/games';

export function useMyGamesInfinite(limit = 20) {
  return useMyGamesInfiniteFiltered(limit, {});
}

export function useMyGamesInfiniteFiltered(
  limit = 20,
  filters: {
    status?: string;
    organizationId?: number;
    result?: string;
    token?: string;
    from?: string;
    to?: string;
  },
) {
  return useInfiniteQuery({
    queryKey: [
      'games',
      'me',
      limit,
      filters.status,
      filters.organizationId,
      filters.result,
      filters.token,
      filters.from,
      filters.to,
    ],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      fetchMyGamesPage({ cursor: pageParam, limit, ...filters }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
