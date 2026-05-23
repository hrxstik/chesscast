'use client';

import { useMyGamesInfiniteFiltered } from '@/lib/hooks/use-my-games-infinite';
import { GameListCard } from '@/components/dashboard/game-list-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { notifyError } from '@/lib/notify';

export function MyGamesList(props: {
  title?: string;
  emptyHint?: string;
  status?: string;
  organizationId?: number;
  result?: string;
  token?: string;
  from?: string;
  to?: string;
}) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status, error } =
    useMyGamesInfiniteFiltered(15, props);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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

  if (games.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{props.title ?? 'Пока нет игр'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {props.emptyHint ?? 'Создайте игру кнопкой «Новая игра».'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {games.map((g) => (
        <GameListCard key={g.id} game={g} />
      ))}
      <div ref={sentinelRef} className="h-4" />
      {isFetchingNextPage ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </div>
  );
}
