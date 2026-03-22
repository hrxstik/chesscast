'use client';

import React from 'react';
import { useEngine } from '@/lib/hooks/useEngine';
import { Text } from '@/components/ui/typography';
import { Badge } from '@/components/ui/badge';
import { SquareChessboard } from '@/components/game/square-chessboard';
import { ChessAnalysisShell } from '@/components/game/chess-analysis-shell';
import { Button } from '@/components/ui/button';
import { SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react';

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default function GamePage({ params }: Props) {
  const { token } = React.use(params);

  const {
    positionEvaluation,
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
          <Text className="text-muted-foreground">
            Режим, результат и участники подтянем с API. Пока заглушка под каркас из ТЗ.
          </Text>
          <Text className="text-xs text-muted-foreground">
            Положительная оценка лучше для белых, отрицательная — для чёрных.
          </Text>
        </>
      }
      whiteLabel={
        <>
          Игрок 1<span className="text-muted-foreground"> · белые</span>
        </>
      }
      board={<SquareChessboard options={chessboardOptions} />}
      blackLabel={
        <>
          Игрок 2<span className="text-muted-foreground"> · чёрные</span>
        </>
      }
      movesPanel={
        <Text className="text-xs text-muted-foreground">
          Нотация и перемотка появятся после связки с бекендом партии.
        </Text>
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
