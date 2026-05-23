"use client";

import React from "react";
import { useEngine } from "@/lib/hooks/useEngine";
import { useGameReplay } from "@/lib/hooks/use-game-replay";
import { Text } from "@/components/ui/typography";
import { BoardWithEvalBar } from "@/components/game/board-with-eval-bar";
import { ChessAnalysisShell } from "@/components/game/chess-analysis-shell";
import { EngineAnalysisLines } from "@/components/game/engine-analysis-lines";
import { Button } from "@/components/ui/button";
import { SkipBack, SkipForward, StepBack, StepForward, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchGameSessionPublic,
  type GameSessionPublic,
} from "@/lib/api/game-session";
import { GameAboutPanel } from "@/components/game/game-about-panel";
import {
  buildFenFromMoves,
  withKingOutcomeMarkers,
} from "@/lib/chess/board-outcome-markers";

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default function GamePage({ params }: Props) {
  const { token } = React.use(params);
  const [session, setSession] = React.useState<GameSessionPublic | null>(null);
  const [statusText, setStatusText] =
    React.useState<string>("Загрузка партии...");
  const [exploreFen, setExploreFen] = React.useState<string | null>(null);

  const replay = useGameReplay(
    session?.moves ?? [],
    session?.initialPosition ?? "startpos",
  );

  const isExploring =
    exploreFen !== null && exploreFen !== replay.currentFen;

  const finalFen = React.useMemo(
    () =>
      session
        ? buildFenFromMoves(session.moves, session.initialPosition)
        : replay.currentFen,
    [session, replay.currentFen],
  );

  const showOutcomeMarkers =
    !!session?.result &&
    session.result !== "CANCELLED" &&
    replay.ply === replay.maxPly &&
    !isExploring;

  const {
    evaluationCpWhite,
    mateWhite,
    pvRows,
    bestLine,
    chessboardOptions,
    isTerminalPosition,
    setPositionFromFen,
  } = useEngine(undefined, {
    multiPv: 3,
    allowMove: true,
    onFenChange: setExploreFen,
  });

  React.useEffect(() => {
    setExploreFen(null);
  }, [replay.currentFen]);

  React.useEffect(() => {
    setPositionFromFen(replay.currentFen);
  }, [replay.currentFen, setPositionFromFen]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetchGameSessionPublic(token);
      if (!mounted) return;
      if (res.ok) {
        if (res.data.status !== "FINISHED") {
          setStatusText("not-finished");
          return;
        }
        if (!res.data.canAnalyze) {
          setStatusText("forbidden");
          return;
        }
        setSession(res.data);
        setStatusText("");
        return;
      }
      if ("forbidden" in res) {
        setStatusText("forbidden");
        return;
      }
      setStatusText("Партия не найдена");
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  const moveRows: { no: number; white?: string; black?: string }[] = [];
  if (session) {
    for (let i = 0; i < session.moves.length; i += 2) {
      moveRows.push({
        no: Math.floor(i / 2) + 1,
        white: session.moves[i],
        black: session.moves[i + 1],
      });
    }
  }

  return (
    <ChessAnalysisShell
      title={
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          Анализ партии
        </h1>
      }
      leftInfo={
        <GameAboutPanel
          session={session}
          statusText={statusText}
          token={token}
        />
      }
      whiteLabel={null}
      board={
        <BoardWithEvalBar
          options={withKingOutcomeMarkers(
            chessboardOptions,
            session?.result,
            finalFen,
            showOutcomeMarkers,
          )}
          cpWhite={evaluationCpWhite}
          mateWhite={mateWhite}
        />
      }
      blackLabel={null}
      movesPanel={
        session ? (
          <div className="space-y-0.5 font-mono text-xs">
            {moveRows.length === 0 ? (
              <Text className="text-muted-foreground">Ходов нет.</Text>
            ) : (
              moveRows.map((row) => {
                const whiteIdx = (row.no - 1) * 2;
                const blackIdx = whiteIdx + 1;
                const activeIdx = replay.ply > 0 ? replay.ply - 1 : -1;
                return (
                  <div key={row.no} className="flex gap-2 tabular-nums">
                    <span className="w-6 shrink-0 text-muted-foreground">
                      {row.no}.
                    </span>
                    <span
                      className={cn(
                        "min-w-[3rem] rounded px-1 py-0.5",
                        activeIdx === whiteIdx &&
                          "bg-primary/15 font-semibold text-primary",
                      )}
                    >
                      {row.white ?? ""}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1 py-0.5",
                        activeIdx === blackIdx &&
                          "bg-primary/15 font-semibold text-primary",
                      )}
                    >
                      {row.black ?? ""}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <Text className="text-xs text-muted-foreground">{statusText}</Text>
        )
      }
      analysisPanel={
        <EngineAnalysisLines
          pvRows={pvRows}
          bestLine={bestLine}
          hidden={isTerminalPosition}
        />
      }
      controlsPanel={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!replay.canPrev}
            className="gap-1"
            onClick={replay.goStart}
          >
            <SkipBack className="size-4" aria-hidden />В начало
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!replay.canPrev}
            className="gap-1"
            onClick={replay.goPrev}
          >
            <StepBack className="size-4" aria-hidden />
            Назад
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!replay.canNext}
            className="gap-1"
            onClick={replay.goNext}
          >
            <StepForward className="size-4" aria-hidden />
            Вперёд
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!replay.canNext}
            className="gap-1"
            onClick={replay.goEnd}
          >
            <SkipForward className="size-4" aria-hidden />В конец
          </Button>
          {isExploring ? (
            <Button
              type="button"
              variant="default"
              className="gap-1"
              onClick={() => {
                setExploreFen(null);
                setPositionFromFen(replay.currentFen);
              }}
            >
              <RotateCcw className="size-4" aria-hidden />
              К позиции партии
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
