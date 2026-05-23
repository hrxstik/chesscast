"use client";

import { MovesList } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EngineAnalysisLines } from "@/components/game/engine-analysis-lines";
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
          <EngineAnalysisLines pvRows={pvRows} bestLine={bestLine} />
        </CardContent>
      </Card>
    </>
  );
}
