"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useEngine } from "@/lib/hooks/useEngine";
import { BoardWithEvalBar } from "@/components/game/board-with-eval-bar";
import { streamVideoContainerClass } from "@/lib/stream-config";
import { Text } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChessStreamGrid } from "@/components/chess-stream/chess-stream-grid";
import { StreamAnalysisSidebar } from "@/components/chess-stream/stream-analysis-sidebar";
import { ChessStreamStreamerControls } from "@/components/chess-stream/chess-stream-streamer-controls";
import { FinishGameDialog } from "@/components/chess-stream/finish-game-dialog";
import { useChessStreamWebRtc } from "@/components/chess-stream/hooks/use-chess-stream-webrtc";
import {
  fetchGameSessionPublic,
  type GameSessionPublic,
} from "@/lib/api/game-session";
import {
  buildFenFromMoves,
  withKingOutcomeMarkers,
} from "@/lib/chess/board-outcome-markers";

const RESULT_FOR_MARKERS = new Set([
  "WHITE_WIN",
  "BLACK_WIN",
  "DRAW",
  "STALEMATE",
  "WHITE_RESIGN",
  "BLACK_RESIGN",
  "WHITE_TIME_OUT",
  "BLACK_TIME_OUT",
]);

interface ChessVideoStreamProps {
  gameToken: string;
  modelPath?: string;
  viewer?: boolean;
}

export const ChessVideoStreamWebRTC: React.FC<ChessVideoStreamProps> = ({
  gameToken,
  modelPath,
  viewer = false,
}) => {
  const router = useRouter();
  const {
    evaluationCpWhite,
    mateWhite,
    engineReady,
    depth,
    bestLine,
    possibleMate,
    chessboardOptions,
    setPositionFromFen,
    pvRows,
    positionEvaluation,
  } = useEngine(undefined, { multiPv: 3 });

  const [session, setSession] = React.useState<GameSessionPublic | null>(null);
  const [finishOpen, setFinishOpen] = React.useState(false);

  const loadSession = React.useCallback(async () => {
    const res = await fetchGameSessionPublic(gameToken);
    if (res.ok) setSession(res.data);
  }, [gameToken]);

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      const res = await fetchGameSessionPublic(gameToken);
      if (mounted && res.ok) setSession(res.data);
    })();
    const t = setInterval(() => {
      void loadSession();
    }, 8000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [gameToken, loadSession]);

  const gameFinished = session?.status === "FINISHED";

  const showResult =
    gameFinished &&
    !!session?.result &&
    RESULT_FOR_MARKERS.has(session.result) &&
    (session.moves?.length ?? 0) > 0;

  const finalFen = React.useMemo(
    () =>
      session
        ? buildFenFromMoves(session.moves, session.initialPosition)
        : (chessboardOptions.position as string),
    [session, chessboardOptions.position],
  );

  const {
    videoRef,
    canvasRef,
    hasVideoStream,
    setHasVideoStream,
    isStreaming,
    viewer: viewerMode,
    startStreaming,
    stopStreaming,
    moves,
    streamerControlsProps,
  } = useChessStreamWebRtc({
    gameToken,
    modelPath,
    viewer,
    setPositionFromFen,
    onGameFinished: () => {
      void loadSession();
    },
  });

  const stopRef = React.useRef(stopStreaming);
  stopRef.current = stopStreaming;

  const goToAnalysis = React.useCallback(() => {
    stopRef.current();
    router.replace(`/game/${gameToken}`);
  }, [gameToken, router]);

  React.useEffect(() => {
    if (!gameFinished) return;
    goToAnalysis();
  }, [gameFinished, goToAnalysis]);

  const boardOptions = withKingOutcomeMarkers(
    chessboardOptions,
    session?.result,
    finalFen,
    showResult,
  );

  return (
    <>
      <div className="space-y-4 md:space-y-5">
        <ChessStreamGrid
          videoColumn={
            <div className={cn(streamVideoContainerClass, "relative")}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-contain"
                style={{
                  display:
                    hasVideoStream || !!videoRef.current?.srcObject
                      ? "block"
                      : "none",
                  backgroundColor: "#000",
                }}
                onLoadedMetadata={() => {
                  void videoRef.current?.play().catch(() => {});
                  setHasVideoStream(true);
                }}
                onCanPlay={() => setHasVideoStream(true)}
                onPlay={() => setHasVideoStream(true)}
                onPlaying={() => setHasVideoStream(true)}
                onLoadedData={() => setHasVideoStream(true)}
                onError={() => setHasVideoStream(false)}
              />
              {!hasVideoStream && !videoRef.current?.srcObject ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-4 text-center">
                  <Text className="!mb-0 text-primary-foreground">
                    {viewerMode ? "Ожидание видеопотока…" : "Видео не запущено"}
                  </Text>
                  {!isStreaming && !viewerMode && !gameFinished ? (
                    <Button type="button" onClick={startStreaming}>
                      Запустить видеопоток
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {hasVideoStream && videoRef.current?.srcObject ? (
                <Badge className="absolute left-2 top-2 z-10" variant="secondary">
                  {viewerMode ? "Просмотр" : "Камера"}
                </Badge>
              ) : null}
              <canvas ref={canvasRef} className="hidden" />
              {isStreaming && hasVideoStream ? (
                <Badge
                  className="absolute right-2 top-2 z-10 border-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  variant="default"
                >
                  LIVE
                </Badge>
              ) : null}
            </div>
          }
          boardColumn={
            <BoardWithEvalBar
              options={boardOptions}
              cpWhite={evaluationCpWhite}
              mateWhite={mateWhite}
            />
          }
          sidebar={
            <StreamAnalysisSidebar
              moves={moves}
              engineReady={engineReady}
              depth={depth}
              positionEvaluation={positionEvaluation}
              possibleMate={possibleMate}
              bestLine={bestLine}
              pvRows={pvRows}
            />
          }
          renderStreamerControls={() => (
            <ChessStreamStreamerControls
              {...streamerControlsProps}
              showControls={!viewerMode && !gameFinished}
              canStopStream={hasVideoStream}
              gameFinished={gameFinished}
              onOpenFinishGame={() => setFinishOpen(true)}
            />
          )}
        />
      </div>

      <FinishGameDialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        gameToken={gameToken}
        onFinished={(s) => {
          setSession(s);
          goToAnalysis();
        }}
      />
    </>
  );
};
