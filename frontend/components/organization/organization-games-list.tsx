'use client';

import { useEffect, useRef } from 'react';
import { notifyError } from '@/lib/notify';
import { GameListCard } from '@/components/dashboard/game-list-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useOrganizationGamesInfinite } from '@/lib/hooks/use-organization-games-infinite';

export function OrganizationGamesList(props: {
  organizationId: number;
  status?: string;
  result?: string;
  token?: string;
  from?: string;
  to?: string;
  title?: string;
  emptyHint?: string;
  /** На обзоре — только первые N карточек без подгрузки */
  previewLimit?: number;
  enableInfiniteScroll?: boolean;
}) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, error } =
    useOrganizationGamesInfinite(props.organizationId, 15, {
      status: props.status,
      result: props.result,
      token: props.token,
      from: props.from,
      to: props.to,
    });
  const sentinelRef = useRef<HTMLDivElement>(null);
  const infinite = props.enableInfiniteScroll !== false && props.previewLimit == null;

  useEffect(() => {
    if (!infinite) return;
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '120px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, infinite]);

  useEffect(() => {
    if (status === 'error' && error) {
      notifyError(
        error instanceof Error ? error.message : 'Не удалось загрузить игры',
      );
    }
  }, [status, error]);

  if (status === 'pending') {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Не удалось загрузить список. Обновите страницу.
          </p>
        </CardContent>
      </Card>
    );
  }

  const games = data.pages.flatMap((p) => p.items);
  const visible =
    props.previewLimit != null ? games.slice(0, props.previewLimit) : games;

  if (visible.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{props.title ?? 'Нет партий'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {props.emptyHint ?? 'Пока нет игр в этой организации.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((g) => (
        <GameListCard key={g.id} game={g} />
      ))}
      {infinite ? (
        <>
          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
