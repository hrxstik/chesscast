import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchOrganizationGamesPage } from '@/lib/api/organizations';

export function useOrganizationGamesInfinite(
  organizationId: number,
  limit = 15,
  filters: {
    status?: string;
    result?: string;
    token?: string;
    from?: string;
    to?: string;
  } = {},
) {
  return useInfiniteQuery({
    queryKey: [
      'organization',
      organizationId,
      'games',
      limit,
      filters.status,
      filters.result,
      filters.token,
      filters.from,
      filters.to,
    ],
    enabled: organizationId > 0,
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      fetchOrganizationGamesPage({
        organizationId,
        cursor: pageParam,
        limit,
        ...filters,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
