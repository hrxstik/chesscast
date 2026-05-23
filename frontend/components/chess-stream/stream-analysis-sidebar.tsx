"use client";

import { MovesList } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import type { EnginePvRow } from "@/lib/hooks/useEngine";

import type { MoveItem } from "@/components/shared/moves-list";

type Props = {
  moves: MoveItem[];
  engineReady: boolean;
  depth: number;
  positionEvaluation: number;
  possibleMate: string;
  bestLine: string;
  pvRows: EnginePvRow[];
};

export function StreamAnalysisSidebar({ moves, bestLine, pvRows }: Props) {
  return (
    <>
      <Card className="border-border/80">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold md:text-base">
            Ходы
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[220px] overflow-y-auto p-0 px-4 pb-4">
          <MovesList moves={moves} />
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold md:text-base">
            Анализ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <div className="space-y-2">
            {pvRows.length > 0 ? (
              pvRows.map((row) => (
                <div
                  key={row.rank}
                  className="rounded-md border border-border/60 bg-muted/20 p-2"
                >
                  <Text className="text-xs text-muted-foreground">
                    Линия {row.rank}
                  </Text>
                  <Text className="mt-0.5 truncate font-mono text-[10px]! leading-tight sm:text-[12px]!">
                    <span className="text-foreground">{row.scoreLabel}</span>
                    {row.pv ? ` ${row.pv}` : ""}
                  </Text>
                </div>
              ))
            ) : (
              <Text className="truncate font-mono text-[10px] leading-tight text-muted-foreground sm:text-[12px]">
                {bestLine || "—"}
              </Text>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
