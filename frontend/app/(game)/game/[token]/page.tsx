"use client";

import React from "react";
import { useEngine } from "@/lib/hooks/useEngine";
import { useGameReplay } from "@/lib/hooks/use-game-replay";
import { Text } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { BoardWithEvalBar } from "@/components/game/board-with-eval-bar";
import { ChessAnalysisShell } from "@/components/game/chess-analysis-shell";
import { PlayerSideLabel } from "@/components/game/player-side-label";
import { Button } from "@/components/ui/button";
import { SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchGameSessionPublic,
  type GameSessionPublic,
} from "@/lib/api/game-session";
import { GameAboutPanel } from "@/components/game/game-about-panel";

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

  const replay = useGameReplay(
    session?.moves ?? [],
    session?.initialPosition ?? "startpos",
  );

  const {
    positionEvaluation,
    evaluationCpWhite,
    mateWhite,
    engineReady,
    depth,
    bestLine,
    possibleMate,
    chessboardOptions,
    setPositionFromFen,
  } = useEngine();

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

  const whitePlayer = session?.players.find((p) => p.color === "WHITE");
  const blackPlayer = session?.players.find((p) => p.color === "BLACK");

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              Анализ партии
            </h1>
            <Text className="mt-0.5 font-mono text-xs text-muted-foreground">
              токен: {token}
            </Text>
          </div>
          <Badge variant="secondary">
            {engineReady ? "Stockfish готов" : "Загрузка движка…"}
          </Badge>
        </div>
      }
      leftInfo={
        <GameAboutPanel
          session={session}
          statusText={statusText}
          token={token}
        />
      }
      whiteLabel={
        <PlayerSideLabel
          name={whitePlayer?.name ?? "Игрок 1"}
          userId={whitePlayer?.userId}
          color="WHITE"
          gameResult={session?.result}
        />
      }
      board={
        <BoardWithEvalBar
          options={chessboardOptions}
          cpWhite={evaluationCpWhite}
          mateWhite={mateWhite}
        />
      }
      blackLabel={
        <PlayerSideLabel
          name={blackPlayer?.name ?? "Игрок 2"}
          userId={blackPlayer?.userId}
          color="BLACK"
          gameResult={session?.result}
        />
      }
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
        <>
          <div className="flex flex-wrap gap-4">
            <div>
              <Text className="text-xs text-muted-foreground">Оценка</Text>
              <p className="text-lg font-semibold tabular-nums">
                {mateWhite != null && mateWhite !== 0
                  ? mateWhite > 0
                    ? `+#${mateWhite}`
                    : `#${mateWhite}`
                  : positionEvaluation >= 0
                    ? `+${positionEvaluation.toFixed(2)}`
                    : positionEvaluation.toFixed(2)}
              </p>
            </div>
            <div>
              <Text className="text-xs text-muted-foreground">Глубина</Text>
              <p className="text-lg font-semibold tabular-nums">{depth}</p>
            </div>
            <div>
              <Text className="text-xs text-muted-foreground">Ход</Text>
              <p className="text-lg font-semibold tabular-nums">
                {replay.ply} / {replay.maxPly}
              </p>
            </div>
          </div>
          <div>
            <Text className="text-xs text-muted-foreground">Лучшая линия</Text>
            <p className="mt-1 truncate font-mono text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
              {bestLine}
            </p>
          </div>
        </>
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
        </div>
      }
    />
  );
}
