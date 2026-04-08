'use client';

import { useMyGamesInfiniteFiltered } from '@/lib/hooks/use-my-games-infinite';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function MyGamesList(props: {
  status?: string;
  mode?: string;
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
          <p className="text-destructive">
            {error instanceof Error ? error.message : 'Не удалось загрузить игры'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Войдите в аккаунт или проверьте, что API доступен.
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
          <CardTitle>Пока нет игр</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Создайте игру из дашборда, когда появится кнопка.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {games.map((g) => (
        <Card key={g.id}>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{g.token.slice(0, 8)}…</span>
                <Badge variant="secondary">{g.status}</Badge>
                <Badge variant="outline">{g.mode}</Badge>
                <Badge variant="muted">{g.visibility}</Badge>
              </div>
              {g.organization && (
                <p className="mt-1 text-sm text-muted-foreground">{g.organization.name}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href={`/game/watch/${g.token}`}>Смотреть</Link>
              </Button>
              <Button asChild>
                <Link href={`/game/${g.token}`}>Играть</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <div ref={sentinelRef} className="h-4" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
