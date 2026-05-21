'use client';

import { useEffect, useState } from 'react';
import { GameListCard } from '@/components/dashboard/game-list-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { fetchOrganizationGames } from '@/lib/api/organizations';
import { ApiError } from '@/lib/api/types';

export function OrganizationGamesList(props: {
  organizationId: number;
  status?: string;
  title?: string;
  emptyHint?: string;
}) {
  const [games, setGames] = useState<Awaited<ReturnType<typeof fetchOrganizationGames>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void (async () => {
      try {
        const g = await fetchOrganizationGames(props.organizationId, {
          status: props.status,
        });
        if (mounted) {
          setGames(g);
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof ApiError ? e.message : 'Не удалось загрузить игры');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [props.organizationId, props.status]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (games.length === 0) {
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
      {games.map((g) => (
        <GameListCard key={g.id} game={g} />
      ))}
    </div>
  );
}
