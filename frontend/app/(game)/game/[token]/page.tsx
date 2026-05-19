'use client';

import React from 'react';
import { useEngine } from '@/lib/hooks/useEngine';
import { Text } from '@/components/ui/typography';
import { Badge } from '@/components/ui/badge';
import { BoardWithEvalBar } from '@/components/game/board-with-eval-bar';
import { ChessAnalysisShell } from '@/components/game/chess-analysis-shell';
import { Button } from '@/components/ui/button';
import { SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react';
import Link from 'next/link';
import { fetchGameSessionPublic, type GameSessionPublic } from '@/lib/api/game-session';

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default function GamePage({ params }: Props) {
  const { token } = React.use(params);
  const [session, setSession] = React.useState<GameSessionPublic | null>(null);
  const [statusText, setStatusText] = React.useState<string>('Загрузка партии...');

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetchGameSessionPublic(token);
      if (!mounted) return;
      if (res.ok) {
        setSession(res.data);
        setStatusText('');
        return;
      }
      if ('forbidden' in res) {
        setStatusText('forbidden');
        return;
      }
      setStatusText('Партия не найдена');
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  const {
    positionEvaluation,
    evaluationCpWhite,
    mateWhite,
    engineReady,
    depth,
    bestLine,
    possibleMate,
    chessboardOptions,
  } = useEngine();

  return (
    <ChessAnalysisShell
      title={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">Анализ партии</h1>
            <Text className="mt-0.5 font-mono text-xs text-muted-foreground">
              token: {token.slice(0, 14)}…
            </Text>
          </div>
          <Badge variant="secondary">{engineReady ? 'Stockfish готов' : 'Загрузка движка…'}</Badge>
        </div>
      }
      leftInfo={
        <>
          {session ? (
            <Text className="text-muted-foreground">
              {session.mode} · {session.status} · {session.result}
              {session.organization ? ` · ${session.organization.name}` : ''}
            </Text>
          ) : statusText === 'forbidden' ? (
            <div className="space-y-3">
              <Text className="text-muted-foreground">
                Эта партия приватная. Доступ только у создателя и игроков, указанных в партии.
              </Text>
              <Link
                href={`/login?next=${encodeURIComponent(`/game/${token}`)}`}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Войти, чтобы проверить доступ
              </Link>
            </div>
          ) : (
            <Text className="text-muted-foreground">{statusText}</Text>
          )}
          <Text className="text-xs text-muted-foreground">
            Положительная оценка лучше для белых, отрицательная — для чёрных.
          </Text>
        </>
      }
      whiteLabel={
        <>
          {session?.players.find((p) => p.color === 'WHITE')?.name ?? 'Игрок 1'}
          <span className="text-muted-foreground"> · белые</span>
        </>
      }
      board={
        <BoardWithEvalBar
          options={chessboardOptions}
          cpWhite={evaluationCpWhite}
          mateWhite={mateWhite}
        />
      }
      blackLabel={
        <>
          {session?.players.find((p) => p.color === 'BLACK')?.name ?? 'Игрок 2'}
          <span className="text-muted-foreground"> · чёрные</span>
        </>
      }
      movesPanel={
        session ? (
          <div className="space-y-1">
            {session.moves.length === 0 ? (
              <Text className="text-xs text-muted-foreground">Ходов пока нет.</Text>
            ) : (
              session.moves.slice(-20).map((m, i) => (
                <Text key={`${m}-${i}`} className="text-xs text-muted-foreground">
                  {session.moves.length - session.moves.slice(-20).length + i + 1}. {m}
                </Text>
              ))
            )}
          </div>
        ) : (
          <Text className="text-xs text-muted-foreground">{statusText}</Text>
        )
      }
      analysisPanel={
        <>
          <div className="flex flex-wrap gap-4">
            <div>
              <Text className="text-xs text-muted-foreground">Оценка</Text>
              <p className="text-lg font-semibold tabular-nums">
                {possibleMate ? `#${possibleMate}` : positionEvaluation}
              </p>
            </div>
            <div>
              <Text className="text-xs text-muted-foreground">Глубина</Text>
              <p className="text-lg font-semibold tabular-nums">{depth}</p>
            </div>
          </div>
          <div>
            <Text className="text-xs text-muted-foreground">Лучшая линия</Text>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {bestLine.slice(0, 120)}
              {bestLine.length > 120 ? '…' : ''}
            </p>
          </div>
        </>
      }
      controlsPanel={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled className="gap-1">
            <SkipBack className="size-4" aria-hidden />
            В начало
          </Button>
          <Button type="button" variant="outline" disabled className="gap-1">
            <StepBack className="size-4" aria-hidden />
            Ход назад
          </Button>
          <Button type="button" variant="outline" disabled className="gap-1">
            <StepForward className="size-4" aria-hidden />
            Ход вперёд
          </Button>
          <Button type="button" variant="outline" disabled className="gap-1">
            <SkipForward className="size-4" aria-hidden />
            В конец
          </Button>
        </div>
      }
    />
  );
}
