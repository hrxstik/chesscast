'use client';

import type { GameListItem } from '@/lib/api/types';
import { getGameUiActions } from '@/lib/game-actions';
import { getConductButtonLabel, getWatchButtonLabel } from '@/lib/game-action-labels';
import {
  labelGameScope,
  labelResult,
  labelStatus,
  labelVisibility,
} from '@/lib/game-labels';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
type Props = {
  game: GameListItem;
};

export function GameListCard({ game }: Props) {
  const actions = getGameUiActions(game);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              {game.token.slice(0, 10)}…
            </span>
            <Badge variant="secondary">{labelStatus(game.status)}</Badge>
            <Badge variant="muted">{labelVisibility(game.visibility)}</Badge>
            <Badge variant="outline" className="border-dashed">
              {labelGameScope(game.organizationId)}
            </Badge>
          </div>
          {game.organization ? (
            <p className="text-sm text-muted-foreground">{game.organization.name}</p>
          ) : null}
          {game.status === 'FINISHED' ? (
            <p className="text-xs text-muted-foreground">
              Итог: {labelResult(game.result)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.showConduct ? (
            <Button asChild>
              <Link href={actions.conductHref}>{getConductButtonLabel(game.status)}</Link>
            </Button>
          ) : null}
          {actions.showWatchLive ? (
            <Button asChild variant={actions.showConduct ? 'outline' : 'default'}>
              <Link href={actions.watchHref}>{getWatchButtonLabel(game.status)}</Link>
            </Button>
          ) : null}
          {actions.showAnalyze ? (
            <Button asChild variant="secondary">
              <Link href={actions.analyzeHref}>Разбор</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
