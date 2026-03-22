'use client';

import { MovesList } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/typography';
import type { EnginePvRow } from '@/lib/hooks/useEngine';

type MoveItem = { san: string; uci: string };

type Props = {
  moves: MoveItem[];
  engineReady: boolean;
  depth: number;
  positionEvaluation: number;
  possibleMate: string;
  bestLine: string;
  pvRows: EnginePvRow[];
};

export function StreamAnalysisSidebar({
  moves,
  engineReady,
  depth,
  positionEvaluation,
  possibleMate,
  bestLine,
  pvRows,
}: Props) {
  return (
    <>
      <Card className="border-border/80">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold md:text-base">Ходы</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[220px] overflow-y-auto p-0 px-4 pb-4">
          <MovesList moves={moves} />
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold md:text-base">Анализ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <Text className="text-muted-foreground">Движок</Text>
              <Text className="font-medium">{engineReady ? 'готов' : 'загрузка…'}</Text>
            </div>
            <div>
              <Text className="text-muted-foreground">Глубина</Text>
              <Text className="font-medium tabular-nums">{depth}</Text>
            </div>
            <div>
              <Text className="text-muted-foreground">Оценка (1-я линия)</Text>
              <Text className="font-medium tabular-nums">
                {possibleMate ? `#${possibleMate}` : positionEvaluation}
              </Text>
            </div>
          </div>

          <div className="space-y-2">
            <Text className="font-medium">Варианты (до 3 линий)</Text>
            {pvRows.length > 0 ? (
              pvRows.map((row) => (
                <div key={row.rank} className="rounded-md border border-border/60 bg-muted/20 p-2">
                  <Text className="text-xs text-muted-foreground">Линия {row.rank}</Text>
                  <Text className="mt-0.5 font-mono text-xs break-all">
                    <span className="text-foreground">{row.scoreLabel}</span>
                    {row.pv ? ` ${row.pv}` : ''}
                  </Text>
                </div>
              ))
            ) : (
              <Text className="font-mono text-xs break-all text-muted-foreground">
                {bestLine || '—'}
              </Text>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold md:text-base">Чат</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Text className="text-muted-foreground">Скоро: сообщения зрителей и команды.</Text>
        </CardContent>
      </Card>
    </>
  );
}
