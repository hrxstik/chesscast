"use client";

import React from "react";
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
import { useChessStreamWebRtc } from "@/components/chess-stream/hooks/use-chess-stream-webrtc";
import { PlayerSideLabel } from "@/components/game/player-side-label";
import {
  fetchGameSessionPublic,
  type GameSessionPublic,
} from "@/lib/api/game-session";

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
    pvRows,
  } = useEngine(undefined, { multiPv: 3 });

  const [session, setSession] = React.useState<GameSessionPublic | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      const res = await fetchGameSessionPublic(gameToken);
      if (mounted && res.ok) setSession(res.data);
    };
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [gameToken]);

  const whitePlayer = session?.players.find((p) => p.color === "WHITE");
  const blackPlayer = session?.players.find((p) => p.color === "BLACK");
  const showResult =
    session?.status === "FINISHED" && session.result !== "CANCELLED";

  const {
    videoRef,
    canvasRef,
    hasVideoStream,
    setHasVideoStream,
    isStreaming,
    viewer: viewerMode,
    startStreaming,
    moves,
    streamerControlsProps,
  } = useChessStreamWebRtc({
    gameToken,
    modelPath,
    viewer,
    setPositionFromFen,
  });

  return (
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
              {!isStreaming && !viewerMode ? (
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
        <>
          <PlayerSideLabel
            name={whitePlayer?.name ?? "Игрок 1"}
            color="WHITE"
            gameResult={showResult ? session?.result : null}
          />
          <BoardWithEvalBar
            options={chessboardOptions}
            cpWhite={evaluationCpWhite}
            mateWhite={mateWhite}
          />
          <PlayerSideLabel
            name={blackPlayer?.name ?? "Игрок 2"}
            color="BLACK"
            gameResult={showResult ? session?.result : null}
          />
        </>
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
        <ChessStreamStreamerControls {...streamerControlsProps} />
      )}
    />
  );
};
