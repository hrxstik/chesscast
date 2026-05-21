'use client';

import React from 'react';
import Link from 'next/link';
import { ChessVideoStreamWebRTC } from '@/components/shared';
import { H1, Text } from '@/components/ui/typography';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchGameSessionPublic } from '@/lib/api/game-session';
import { labelStatus } from '@/lib/game-labels';

type StreamMode = 'conduct' | 'viewer';

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default function WatchGamePage({ params }: Props) {
  const resolvedParams = React.use(params);
  const [sessionStatus, setSessionStatus] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<StreamMode | null>(null);
  const [forbidden, setForbidden] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      const res = await fetchGameSessionPublic(resolvedParams.token);
      if (!mounted) return;
      if (!res.ok) {
        setForbidden('forbidden' in res);
        setMode(null);
        return;
      }
      setSessionStatus(res.data.status);
      if (res.data.canConduct) {
        setMode('conduct');
        setForbidden(false);
      } else if (res.data.canWatchLive) {
        setMode('viewer');
        setForbidden(false);
      } else {
        setMode(null);
        setForbidden(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [resolvedParams.token]);

  if (mode === null && !forbidden) {
    return (
      <Text className="text-muted-foreground">Проверка доступа…</Text>
    );
  }

  if (forbidden || mode === null) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-6">
        <H1 className="!text-xl">Нет доступа</H1>
        <Text className="text-muted-foreground">
          Трансляция недоступна: партия закрытая, завершена, или у вас нет прав
          на ведение или просмотр.
        </Text>
        <Button asChild variant="outline">
          <Link href="/dashboard/games">К списку игр</Link>
        </Button>
      </div>
    );
  }

  if (sessionStatus === 'FINISHED') {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-6">
        <H1 className="!text-xl">Партия завершена</H1>
        <Text className="text-muted-foreground">
          Live-трансляция недоступна. Откройте разбор с записью ходов и анализом движка.
        </Text>
        <Button asChild>
          <Link href={`/game/${resolvedParams.token}`}>Перейти к разбору</Link>
        </Button>
      </div>
    );
  }

  const isViewer = mode === 'viewer';

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <H1 className="!text-xl md:!text-2xl">
            {isViewer ? 'Просмотр трансляции' : 'Ведение трансляции'}
          </H1>
          <Text className="!mt-1 !mb-0 font-mono text-xs text-muted-foreground">
            token: {resolvedParams.token.slice(0, 16)}…
            {sessionStatus ? ` · ${labelStatus(sessionStatus)}` : ''}
          </Text>
        </div>
        <Badge variant={isViewer ? 'secondary' : 'default'}>
          {isViewer ? 'Зритель' : 'Ведущий'}
        </Badge>
      </div>

      <ChessVideoStreamWebRTC
        gameToken={resolvedParams.token}
        viewer={isViewer}
      />
    </div>
  );
}
