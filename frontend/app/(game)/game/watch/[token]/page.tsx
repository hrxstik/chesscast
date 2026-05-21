'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChessVideoStreamWebRTC } from '@/components/shared';
import { H1, Text } from '@/components/ui/typography';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchGameSessionPublic } from '@/lib/api/game-session';
import { labelStatus } from '@/lib/game-labels';

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default function WatchGamePage({ params }: Props) {
  const resolvedParams = React.use(params);
  const searchParams = useSearchParams();
  const viewerParam = searchParams.get('viewer');
  const viewer = viewerParam === null ? true : viewerParam === 'true';
  const [sessionStatus, setSessionStatus] = React.useState<string | null>(null);
  const [allowed, setAllowed] = React.useState<boolean | null>(null);
  const [forbidden, setForbidden] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      const res = await fetchGameSessionPublic(resolvedParams.token);
      if (!mounted) return;
      if (!res.ok) {
        setForbidden('forbidden' in res);
        setAllowed(false);
        return;
      }
      setSessionStatus(res.data.status);
      const mayEnter = viewer ? res.data.canWatchLive : res.data.canConduct;
      setAllowed(mayEnter);
      setForbidden(!mayEnter);
    })();
    return () => {
      mounted = false;
    };
  }, [resolvedParams.token, viewer]);

  if (allowed === null) {
    return (
      <Text className="text-muted-foreground">Проверка доступа…</Text>
    );
  }

  if (forbidden) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-6">
        <H1 className="!text-xl">Нет доступа</H1>
        <Text className="text-muted-foreground">
          {viewer
            ? 'Просмотр трансляции недоступен: партия закрытая или вы не входите в список участников.'
            : 'Вести трансляцию может только создатель партии, пока она не завершена.'}
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

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <H1 className="!text-xl md:!text-2xl">
            {viewer ? 'Просмотр трансляции' : 'Ведение трансляции'}
          </H1>
          <Text className="!mt-1 !mb-0 font-mono text-xs text-muted-foreground">
            token: {resolvedParams.token.slice(0, 16)}…
            {sessionStatus ? ` · ${labelStatus(sessionStatus)}` : ''}
          </Text>
        </div>
        <Badge variant={viewer ? 'secondary' : 'default'}>
          {viewer ? 'Зритель' : 'Ведущий'}
        </Badge>
      </div>

      <ChessVideoStreamWebRTC gameToken={resolvedParams.token} viewer={viewer} />
    </div>
  );
}
